import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { ActivityType, CollaboratorStatus, DealRole, FollowUpOutcome, Prisma } from "@rrs/db";
import type { AuthUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { DataScopeService } from "../rbac/data-scope.service";

export interface AddActivityInput {
  type: ActivityType;
  body: string;
  outcome?: FollowUpOutcome | null;
  nextFollowUpAt?: string | null;
}

@Injectable()
export class LeadOwnershipService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataScope: DataScopeService,
  ) {}

  async transfer(user: AuthUser, leadId: string, toUserId: string, reason: string) {
    const scopedWhere = this.dataScope.where(user, "leads", "lead.assign") as Prisma.LeadWhereInput;
    const lead = await this.prisma.lead.findFirst({ where: { AND: [{ id: leadId }, scopedWhere] } });
    if (!lead) {
      throw new ForbiddenException({ code: "FORBIDDEN", message: "คุณไม่มีสิทธิ์โอนลูกค้ารายนี้" });
    }

    const updated = await this.prisma.lead.update({
      where: { id: leadId },
      data: {
        ownerAgentId: toUserId,
        updatedById: user.id,
        assignments: {
          create: {
            fromUserId: lead.ownerAgentId,
            toUserId,
            assignedById: user.id,
            reason: reason.trim(),
          },
        },
      },
    });

    await this.prisma.notification.create({
      data: {
        userId: toUserId,
        event: "lead.assigned",
        title: `ได้รับมอบหมายลูกค้า ${lead.code}`,
        body: `เหตุผล: ${reason.trim()}`,
        link: `/leads/${leadId}`,
      },
    });

    return updated;
  }

  async requestCollaboration(user: AuthUser, leadId: string, role: DealRole) {
    const lead = await this.prisma.lead.findFirst({ where: { id: leadId, archivedAt: null } });
    if (!lead) throw new NotFoundException({ code: "LEAD_NOT_FOUND", message: "ไม่พบข้อมูลลูกค้านี้" });

    return this.prisma.leadCollaborator.upsert({
      where: { leadId_userId_role: { leadId, userId: user.id, role } },
      update: { status: "PENDING", requestedAt: new Date(), decidedById: null, decidedAt: null },
      create: { leadId, userId: user.id, role, status: "PENDING" },
    });
  }

  async decideCollaboration(
    user: AuthUser,
    leadId: string,
    targetUserId: string,
    role: DealRole,
    status: Extract<CollaboratorStatus, "APPROVED" | "REJECTED">,
  ) {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, archivedAt: null },
      include: { ownerAgent: { select: { teamId: true } } },
    });
    if (!lead) throw new NotFoundException({ code: "LEAD_NOT_FOUND", message: "ไม่พบข้อมูลลูกค้านี้" });

    const isOwner = lead.ownerAgentId === user.id;
    const assignScope = user.permissions?.["lead.assign"];
    const canAssign =
      assignScope === "ALL" ||
      (assignScope === "TEAM" && Boolean(user.teamId && lead.ownerAgent.teamId === user.teamId));

    if (!isOwner && !canAssign) {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "เฉพาะเจ้าของลูกค้าหรือผู้จัดการทีมเท่านั้นที่อนุมัติผู้ร่วมงานได้",
      });
    }

    return this.prisma.leadCollaborator.update({
      where: { leadId_userId_role: { leadId, userId: targetUserId, role } },
      data: { status, decidedById: user.id, decidedAt: new Date() },
    });
  }

  async listActivities(user: AuthUser, leadId: string) {
    const scopedWhere = this.dataScope.where(user, "leads", "lead.read") as Prisma.LeadWhereInput;
    const lead = await this.prisma.lead.findFirst({ where: { AND: [{ id: leadId }, scopedWhere] } });
    if (!lead) throw new ForbiddenException({ code: "FORBIDDEN", message: "คุณไม่มีสิทธิ์ดูประวัติลูกค้ารายนี้" });

    const items = await this.prisma.activity.findMany({
      where: { leadId },
      orderBy: { createdAt: "desc" },
      include: { createdBy: { select: { id: true, fullName: true } } },
    });
    return { items };
  }

  async addActivity(user: AuthUser, leadId: string, input: AddActivityInput) {
    const scopedWhere = this.dataScope.where(user, "leads", "lead.write") as Prisma.LeadWhereInput;
    const lead = await this.prisma.lead.findFirst({ where: { AND: [{ id: leadId }, scopedWhere] } });
    if (!lead) throw new ForbiddenException({ code: "FORBIDDEN", message: "คุณไม่มีสิทธิ์บันทึกกิจกรรมลูกค้ารายนี้" });

    const nextFollowUp = input.nextFollowUpAt ? new Date(input.nextFollowUpAt) : undefined;
    const activity = await this.prisma.activity.create({
      data: {
        leadId,
        type: input.type,
        body: input.body.trim(),
        outcome: input.outcome ?? null,
        nextFollowUpAt: nextFollowUp ?? null,
        createdById: user.id,
      },
      include: { createdBy: { select: { id: true, fullName: true } } },
    });

    await this.prisma.lead.update({
      where: { id: leadId },
      data: {
        lastActivityAt: new Date(),
        ...(nextFollowUp !== undefined ? { nextFollowUpAt: nextFollowUp } : {}),
        updatedById: user.id,
      },
    });
    return activity;
  }

  async checkInactiveLeads(inactiveDays = 30) {
    const cutoff = new Date(Date.now() - inactiveDays * 86_400_000);
    const staleLeads = await this.prisma.lead.findMany({
      where: {
        archivedAt: null,
        status: { notIn: ["CLOSED_WON", "LOST", "CANCELLED"] },
        OR: [{ lastActivityAt: { lt: cutoff } }, { lastActivityAt: null, createdAt: { lt: cutoff } }],
      },
      include: {
        ownerAgent: {
          include: { team: { select: { managerId: true } } },
        },
      },
    });

    const dateKey = new Date().toISOString().slice(0, 10);
    let notifiedCount = 0;

    for (const lead of staleLeads) {
      const recipientId = lead.ownerAgent.team?.managerId ?? lead.ownerAgentId;
      const dedupeKey = `lead.inactive:${lead.id}:${dateKey}`;
      await this.prisma.notification.upsert({
        where: { dedupeKey },
        update: {},
        create: {
          userId: recipientId,
          event: "lead.inactive",
          title: `ลูกค้า ${lead.code} ไม่มีกิจกรรมเกิน ${inactiveDays} วัน`,
          body: `${lead.fullName} (ผู้ดูแล: ${lead.ownerAgent.fullName}) ไม่มีความเคลื่อนไหวเกิน ${inactiveDays} วัน`,
          link: `/leads/${lead.id}`,
          dedupeKey,
        },
      });
      notifiedCount++;
    }

    return { inactiveDays, notifiedCount };
  }
}
