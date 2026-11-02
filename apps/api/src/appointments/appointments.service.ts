import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { type LeadStatus, Prisma, nextCode } from "@rrs/db";
import { AssetStatusService } from "../assets/asset-status.service";
import type { AuthUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { DataScopeService } from "../rbac/data-scope.service";
import { completeAppointmentWithFollowUp } from "./appointment-followup.helper";
import {
  type AppointmentRecord,
  type CalendarQueryInput,
  type CreateAppointmentInput,
  type RescheduleAppointmentInput,
  type UpdateAppointmentStatusInput,
  appointmentInclude,
  formatCalendarAppointment,
  parseAppointmentRange,
} from "./appointments.types";

const PRE_VIEWING_STATUSES: LeadStatus[] = ["NEW", "CONTACTED", "QUALIFIED", "UNDECIDED"];

export interface OverlapRow {
  id: string;
  code: string;
  startsAt: Date;
  endsAt: Date;
  location: string | null;
  status: string;
}

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataScope: DataScopeService,
    private readonly assetStatus: AssetStatusService,
  ) {}

  private scopeWhere(user: AuthUser, perm: "appointment.read" | "appointment.write"): Prisma.AppointmentWhereInput {
    const { archivedAt: _unused, ...rest } = this.dataScope.where(user, "appointments", perm);
    return rest as Prisma.AppointmentWhereInput;
  }

  async findOverlaps(agentId: string, startsAt: Date, endsAt: Date, excludeId?: string): Promise<OverlapRow[]> {
    const excludeClause = excludeId ? Prisma.sql`AND a.id <> ${excludeId}::uuid` : Prisma.empty;
    return this.prisma.$queryRaw<OverlapRow[]>(Prisma.sql`
      SELECT a.id, a.code, a.starts_at AS "startsAt", a.ends_at AS "endsAt", a.location, a.status::text AS status
      FROM appointments a
      WHERE a.agent_id = ${agentId}::uuid
        AND a.status IN ('PENDING', 'CONFIRMED')
        AND tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(${startsAt}::timestamptz, ${endsAt}::timestamptz, '[)')
        ${excludeClause}
      ORDER BY a.starts_at ASC
    `);
  }

  private async checkOverlapGuard(
    agentId: string,
    startsAt: Date,
    endsAt: Date,
    confirmOverlap?: boolean,
    excludeId?: string,
  ) {
    const overlaps = await this.findOverlaps(agentId, startsAt, endsAt, excludeId);
    if (overlaps.length > 0 && !confirmOverlap) {
      throw new ConflictException({
        code: "APPOINTMENT_OVERLAP_WARNING",
        message: "Agent ผู้พาดูห้องมีนัดหมายอื่นในช่วงเวลาเดียวกัน กรุณายืนยันหากต้องการบันทึกนัดซ้อน",
        details: { overlaps },
      });
    }
    return overlaps;
  }

  async listCalendar(user: AuthUser, query: CalendarQueryInput) {
    const scope = this.dataScope.scopeFor(user, "appointment.read");
    const where: Prisma.AppointmentWhereInput = {
      ...(query.from ? { endsAt: { gt: new Date(query.from) } } : {}),
      ...(query.to ? { startsAt: { lt: new Date(query.to) } } : {}),
      ...(query.agentId ? { agentId: query.agentId } : {}),
      ...(query.teamId ? { agent: { teamId: query.teamId } } : {}),
      ...(query.leadId ? { leadId: query.leadId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const rows = await this.prisma.appointment.findMany({
      where,
      orderBy: { startsAt: "asc" },
      include: appointmentInclude,
    });
    return { items: rows.map((r) => formatCalendarAppointment(user, r as unknown as AppointmentRecord, scope)) };
  }

  async getById(user: AuthUser, id: string) {
    const appt = await this.prisma.appointment.findFirst({
      where: { AND: [{ id }, this.scopeWhere(user, "appointment.read")] },
      include: appointmentInclude,
    });
    if (!appt) throw new NotFoundException({ code: "NOT_FOUND", message: "ไม่พบข้อมูลนัดหมาย" });
    return appt;
  }

  async create(user: AuthUser, input: CreateAppointmentInput) {
    const { startsAt, endsAt } = parseAppointmentRange(input.startsAt, input.endsAt);
    const agentId = input.agentId ?? user.id;
    const assetIds = Array.from(new Set(input.assetIds));
    const overlaps = await this.checkOverlapGuard(agentId, startsAt, endsAt, input.confirmOverlap);

    const created = await this.prisma.$transaction(async (tx) => {
      const lead = await tx.lead.findFirst({ where: { id: input.leadId, archivedAt: null } });
      if (!lead) throw new NotFoundException({ code: "LEAD_NOT_FOUND", message: "ไม่พบข้อมูลลูกค้า" });
      const code = await nextCode(tx, "AP", "AP-");
      const appt = await tx.appointment.create({
        data: {
          code,
          leadId: input.leadId,
          startsAt,
          endsAt,
          location: input.location ?? null,
          agentId,
          coordinatorId: input.coordinatorId ?? null,
          coordinatorName: input.coordinatorName ?? null,
          coordinatorPhone: input.coordinatorPhone ?? null,
          note: input.note ?? null,
          status: "PENDING",
          createdById: user.id,
          updatedById: user.id,
          items: { create: assetIds.map((assetId, sortOrder) => ({ assetId, sortOrder })) },
        },
        include: appointmentInclude,
      });
      if (PRE_VIEWING_STATUSES.includes(lead.status)) {
        await tx.lead.update({
          where: { id: lead.id },
          data: { status: "VIEWING", lastActivityAt: new Date(), updatedById: user.id },
        });
      }
      return appt;
    });

    await this.assetStatus.recomputeMany(assetIds, user.id);
    return { appointment: created, overlaps, overlapWarning: overlaps.length > 0 };
  }

  async updateStatus(user: AuthUser, id: string, input: UpdateAppointmentStatusInput) {
    const existing = await this.getById(user, id);
    this.dataScope.scopeFor(user, "appointment.write");

    const updated =
      input.status === "COMPLETED"
        ? await completeAppointmentWithFollowUp(this.prisma, user.id, existing, input)
        : await this.prisma.appointment.update({
            where: { id },
            data: {
              status: input.status,
              ...(input.note !== undefined ? { note: input.note } : {}),
              updatedById: user.id,
            },
            include: appointmentInclude,
          });

    await this.assetStatus.recomputeMany(
      existing.items.map((i) => i.assetId),
      user.id,
    );
    return updated;
  }

  async reschedule(user: AuthUser, id: string, input: RescheduleAppointmentInput) {
    const existing = await this.getById(user, id);
    this.dataScope.scopeFor(user, "appointment.write");
    if (existing.status !== "PENDING" && existing.status !== "CONFIRMED") {
      throw new BadRequestException({
        code: "INVALID_STATUS_TRANSITION",
        message: "เลื่อนนัดได้เฉพาะสถานะรอยืนยันหรือยืนยันแล้ว",
      });
    }
    const { startsAt, endsAt } = parseAppointmentRange(input.startsAt, input.endsAt);
    const agentId = input.agentId ?? existing.agentId;
    const overlaps = await this.checkOverlapGuard(agentId, startsAt, endsAt, input.confirmOverlap, existing.id);
    const nextIds = input.assetIds ? Array.from(new Set(input.assetIds)) : existing.items.map((i) => i.assetId);

    const created = await this.prisma.$transaction(async (tx) => {
      await tx.appointment.update({
        where: { id: existing.id },
        data: { status: "RESCHEDULED", updatedById: user.id },
      });
      const code = await nextCode(tx, "AP", "AP-");
      return tx.appointment.create({
        data: {
          code,
          leadId: existing.leadId,
          startsAt,
          endsAt,
          location: input.location ?? existing.location,
          agentId,
          coordinatorId: input.coordinatorId ?? existing.coordinatorId,
          coordinatorName: input.coordinatorName ?? existing.coordinatorName,
          coordinatorPhone: input.coordinatorPhone ?? existing.coordinatorPhone,
          note: input.note ?? existing.note,
          status: "PENDING",
          rescheduledFromId: existing.id,
          createdById: user.id,
          updatedById: user.id,
          items: { create: nextIds.map((assetId, sortOrder) => ({ assetId, sortOrder })) },
        },
        include: appointmentInclude,
      });
    });

    await this.assetStatus.recomputeMany([...existing.items.map((i) => i.assetId), ...nextIds], user.id);
    return { previousAppointmentId: existing.id, appointment: created, overlaps };
  }
}
