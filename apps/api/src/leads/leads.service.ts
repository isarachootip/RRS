import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { type LeadSource, type LeadStatus, type Prisma, nextCode } from "@rrs/db";
import { abbreviateName, normalizePhone } from "@rrs/shared";
import type { AuthUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { DataScopeService } from "../rbac/data-scope.service";
import { type LeadWithRelations, redactLeadInList } from "../rbac/field-redaction";
import {
  type ListLeadsParams,
  type UpsertLeadInput,
  buildLeadCreateData,
  buildLeadUpdateData,
  leadDetailInclude,
  leadListInclude,
  requiresReasonForStatusChange,
} from "./leads.types";

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataScope: DataScopeService,
  ) {}

  private parseNormalizedPhone(raw: string | null | undefined): string | null | undefined {
    if (raw === undefined) return undefined;
    if (raw === null || raw.trim() === "") return null;
    const norm = normalizePhone(raw);
    if (!norm) throw new BadRequestException({ code: "INVALID_PHONE", message: "รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง" });
    return norm;
  }

  async checkDuplicates(user: AuthUser, query: { phone?: string; line?: string; email?: string; excludeId?: string }) {
    const or: Prisma.LeadWhereInput[] = [];
    if (query.phone?.trim()) or.push({ phone: normalizePhone(query.phone) ?? query.phone.trim() });
    if (query.line?.trim()) or.push({ lineId: { equals: query.line.trim(), mode: "insensitive" } });
    if (query.email?.trim()) or.push({ email: { equals: query.email.trim(), mode: "insensitive" } });
    if (or.length === 0) return { items: [] };

    const leads = await this.prisma.lead.findMany({
      where: { archivedAt: null, ...(query.excludeId ? { id: { not: query.excludeId } } : {}), OR: or },
      include: { ownerAgent: { select: { id: true, fullName: true } } },
      take: 10,
    });

    for (const l of leads) {
      if (l.ownerAgentId !== user.id) {
        await this.prisma.notification.create({
          data: {
            userId: l.ownerAgentId,
            event: "lead.duplicate_detected",
            title: `มีผู้ค้นพบข้อมูลลูกค้าซ้ำ (${l.code})`,
            body: `${user.email} ค้นพบลูกค้าที่ตรงกับ ${l.code}`,
            link: `/leads/${l.id}`,
          },
        });
      }
    }

    return {
      items: leads.map((l) => ({
        id: l.id,
        code: l.code,
        fullName: abbreviateName(l.fullName),
        status: l.status,
        ownerAgentId: l.ownerAgentId,
        ownerAgentName: l.ownerAgent.fullName,
      })),
    };
  }

  async list(user: AuthUser, params: ListLeadsParams) {
    const baseWhere: Prisma.LeadWhereInput =
      params.includeDirectory === "true"
        ? { archivedAt: null }
        : (this.dataScope.where(user, "leads", "lead.read") as Prisma.LeadWhereInput);
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 50));
    const q = params.search?.trim();
    const normPhone = q ? normalizePhone(q) : null;

    const where: Prisma.LeadWhereInput = {
      AND: [
        baseWhere,
        ...(params.status ? [{ status: params.status }] : []),
        ...(params.intent ? [{ intent: params.intent }] : []),
        ...(params.ownerAgentId ? [{ ownerAgentId: params.ownerAgentId }] : []),
        ...(q
          ? [
              {
                OR: [
                  { fullName: { contains: q, mode: "insensitive" as const } },
                  { code: { contains: q, mode: "insensitive" as const } },
                  { phone: { contains: normPhone ?? q } },
                  { preferredLocation: { contains: q, mode: "insensitive" as const } },
                ],
              },
            ]
          : []),
      ],
    };

    const [total, rows] = await Promise.all([
      this.prisma.lead.count({ where }),
      this.prisma.lead.findMany({
        where,
        orderBy: { [params.sortBy ?? "createdAt"]: params.sortDir ?? "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: leadListInclude,
      }),
    ]);

    return {
      total,
      page,
      pageSize,
      items: rows.map((l) => redactLeadInList(user, l as unknown as LeadWithRelations)),
    };
  }

  async getById(user: AuthUser, id: string) {
    const exists = await this.prisma.lead.findFirst({ where: { id, archivedAt: null } });
    if (!exists) throw new NotFoundException({ code: "LEAD_NOT_FOUND", message: "ไม่พบข้อมูลลูกค้านี้" });

    const scopedWhere = this.dataScope.where(user, "leads", "lead.read") as Prisma.LeadWhereInput;
    const lead = await this.prisma.lead.findFirst({
      where: { AND: [{ id }, scopedWhere] },
      include: leadDetailInclude,
    });
    if (!lead) throw new ForbiddenException({ code: "FORBIDDEN", message: "คุณไม่มีสิทธิ์ดูข้อมูลลูกค้ารายนี้" });
    return lead;
  }

  async create(user: AuthUser, input: UpsertLeadInput & { fullName: string; source: LeadSource }) {
    const code = await nextCode(this.prisma, "LD", "LD-");
    const phone = this.parseNormalizedPhone(input.phone) ?? null;
    return this.prisma.lead.create({
      data: buildLeadCreateData(user.id, code, phone, input),
      include: leadDetailInclude,
    });
  }

  async update(user: AuthUser, id: string, input: UpsertLeadInput) {
    const scopedWhere = this.dataScope.where(user, "leads", "lead.write") as Prisma.LeadWhereInput;
    const before = await this.prisma.lead.findFirst({ where: { AND: [{ id }, scopedWhere] } });
    if (!before) throw new ForbiddenException({ code: "FORBIDDEN", message: "คุณไม่มีสิทธิ์แก้ไขข้อมูลลูกค้ารายนี้" });
    const phone = this.parseNormalizedPhone(input.phone);

    return this.prisma.lead.update({
      where: { id },
      data: buildLeadUpdateData(user.id, input, phone),
    });
  }

  async updateStatus(user: AuthUser, id: string, status: LeadStatus, reason?: string | null) {
    const scopedWhere = this.dataScope.where(user, "leads", "lead.write") as Prisma.LeadWhereInput;
    const before = await this.prisma.lead.findFirst({ where: { AND: [{ id }, scopedWhere] } });
    if (!before) throw new ForbiddenException({ code: "FORBIDDEN", message: "คุณไม่มีสิทธิ์เปลี่ยนสถานะลูกค้ารายนี้" });

    if (requiresReasonForStatusChange(before.status, status) && !reason?.trim()) {
      throw new BadRequestException({
        code: "REASON_REQUIRED",
        message: "กรุณาระบุเหตุผลเมื่อย้อนสถานะหรือเปลี่ยนเป็น Lost / ยกเลิก / ยังไม่ตัดสินใจ",
      });
    }

    const updated = await this.prisma.lead.update({
      where: { id },
      data: {
        status,
        statusReason: reason?.trim() || null,
        lastActivityAt: new Date(),
        updatedById: user.id,
      },
    });

    await this.prisma.activity.create({
      data: {
        leadId: id,
        type: "STATUS_CHANGE",
        body: `เปลี่ยนสถานะ ${before.status} → ${status}${reason?.trim() ? ` (${reason.trim()})` : ""}`,
        createdById: user.id,
      },
    });
    return updated;
  }

  async archive(user: AuthUser, id: string) {
    const scopedWhere = this.dataScope.where(user, "leads", "lead.write") as Prisma.LeadWhereInput;
    const before = await this.prisma.lead.findFirst({ where: { AND: [{ id }, scopedWhere] } });
    if (!before) throw new ForbiddenException({ code: "FORBIDDEN", message: "คุณไม่มีสิทธิ์เก็บลูกค้ารายนี้เข้ากรุ" });
    return this.prisma.lead.update({
      where: { id },
      data: { archivedAt: new Date(), archivedById: user.id, updatedById: user.id },
    });
  }
}
