import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsDispatcherService } from "./notifications-dispatcher.service";
import { ensureDefaultNotificationRules } from "./notifications-recipients.helper";

const DAY_MS = 86_400_000;
const MIN_MS = 60_000;

function pickThreshold(value: number, thresholds: number[]): number | null {
  const sorted = [...thresholds].sort((a, b) => a - b);
  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i]!;
    const prev = i > 0 ? sorted[i - 1]! : 0;
    if (value > prev && value <= current) return current;
  }
  return null;
}

@Injectable()
export class NotificationsSchedulerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dispatcher: NotificationsDispatcherService,
  ) {}

  async runScheduledChecks(now: Date = new Date()) {
    await ensureDefaultNotificationRules(this.prisma);
    const rules = await this.prisma.notificationRule.findMany({ where: { isEnabled: true } });
    const ruleMap = new Map(rules.map((r) => [r.event, r]));
    let totalSent = 0;
    let totalSkippedDuplicate = 0;
    const tally = (res: { sentCount: number; skippedDuplicateCount: number }) => {
      totalSent += res.sentCount;
      totalSkippedDuplicate += res.skippedDuplicateCount;
    };

    const apptRule = ruleMap.get("appointment.reminder");
    if (apptRule) {
      const timing = (apptRule.timing ?? {}) as { minutesBefore?: number[] };
      const minsList = timing.minutesBefore?.length ? timing.minutesBefore : [1440, 120];
      const upperBound = new Date(now.getTime() + Math.max(...minsList) * MIN_MS);
      const appts = await this.prisma.appointment.findMany({
        where: { status: { in: ["PENDING", "CONFIRMED"] }, startsAt: { gt: now, lte: upperBound } },
        include: { lead: true },
      });
      for (const appt of appts) {
        const matchedMin = pickThreshold((appt.startsAt.getTime() - now.getTime()) / MIN_MS, minsList);
        if (!matchedMin) continue;
        const unitLabel =
          matchedMin >= 1440 ? `${Math.round(matchedMin / 1440)} วัน` : `${Math.round(matchedMin / 60)} ชั่วโมง`;
        tally(
          await this.dispatcher.dispatchEvent({
            event: "appointment.reminder",
            title: `เตือนนัดดูห้อง ${appt.code} (อีก ${unitLabel})`,
            body: `ลูกค้า: ${appt.lead.fullName} สถานที่: ${appt.location ?? "-"}`,
            link: "/appointments",
            dedupeBaseKey: `appointment.reminder:${appt.id}:${matchedMin}m`,
            context: { appointmentAgentId: appt.agentId, appointmentCoordinatorId: appt.coordinatorId },
          }),
        );
      }
    }

    const followRule = ruleMap.get("followup.due");
    if (followRule) {
      const timing = (followRule.timing ?? {}) as { escalateToManagerAfterDays?: number };
      const escalateDays = timing.escalateToManagerAfterDays ?? 1;
      const dueActivities = await this.prisma.activity.findMany({
        where: {
          nextFollowUpAt: { lte: now },
          lead: { archivedAt: null, status: { notIn: ["CLOSED_WON", "LOST", "CONTRACTED"] } },
        },
        include: { lead: { include: { ownerAgent: true } } },
      });
      for (const act of dueActivities) {
        if (!act.lead || !act.nextFollowUpAt) continue;
        const ctx = { leadOwnerId: act.lead.ownerAgentId, teamId: act.lead.ownerAgent?.teamId ?? null };
        tally(
          await this.dispatcher.dispatchEvent({
            event: "followup.due",
            title: `ถึงกำหนดติดตามลูกค้า ${act.lead.code}`,
            body: `ลูกค้า: ${act.lead.fullName} (${act.body})`,
            link: `/leads/${act.lead.id}`,
            dedupeBaseKey: `followup.due:${act.id}:owner`,
            context: ctx,
          }),
        );
        if (now.getTime() - act.nextFollowUpAt.getTime() >= escalateDays * DAY_MS) {
          tally(
            await this.dispatcher.dispatchEvent({
              event: "followup.due",
              title: `เลยกำหนดติดตามลูกค้า ${act.lead.code} เกิน ${escalateDays} วัน`,
              body: `ลูกค้า: ${act.lead.fullName} ผู้ดูแลยังไม่บันทึกการติดตาม`,
              link: `/leads/${act.lead.id}`,
              dedupeBaseKey: `followup.due:${act.id}:escalate`,
              context: ctx,
              overrideRecipients: ["TEAM_MANAGER"],
            }),
          );
        }
      }
    }

    const contractRule = ruleMap.get("contract.expiring");
    if (contractRule) {
      const timing = (contractRule.timing ?? {}) as { daysBefore?: number[] };
      const defaultDays = timing.daysBefore?.length ? timing.daysBefore : [90, 60, 30];
      const upperDate = new Date(now.getTime() + Math.max(...defaultDays, 90) * DAY_MS);
      const contracts = await this.prisma.contract.findMany({
        where: { status: "ACTIVE", endDate: { gt: now, lte: upperDate } },
        include: { asset: { include: { primaryAgent: true } }, lead: true },
      });
      for (const c of contracts) {
        const daysLeft = Math.ceil((c.endDate.getTime() - now.getTime()) / DAY_MS);
        const matchedDay = pickThreshold(daysLeft, c.reminderDays?.length ? c.reminderDays : defaultDays);
        if (!matchedDay) continue;
        tally(
          await this.dispatcher.dispatchEvent({
            event: "contract.expiring",
            title: `สัญญาเช่า ${c.contractNo} จะครบกำหนดในอีก ${matchedDay} วัน`,
            body: `ห้อง ${c.asset.code} ลูกค้า ${c.lead.fullName}`,
            link: "/deals",
            dedupeBaseKey: `contract.expiring:${c.id}:${matchedDay}d`,
            context: { assetAgentId: c.asset.primaryAgentId, teamId: c.asset.primaryAgent?.teamId ?? null },
          }),
        );
      }
    }

    if (ruleMap.has("commission.due")) {
      const dueCommissions = await this.prisma.commission.findMany({
        where: {
          OR: [
            { status: "AWAITING_OWNER_PAYMENT", ownerPaymentDueAt: { lte: now } },
            { status: "APPROVED", ownershipType: "OWNER" },
          ],
        },
        include: { asset: true },
      });
      for (const cm of dueCommissions) {
        tally(
          await this.dispatcher.dispatchEvent({
            event: "commission.due",
            title: `ถึงกำหนดรับ/จ่ายค่านายหน้า ห้อง ${cm.asset.code}`,
            body: `ยอดค่านายหน้ารวม ${cm.totalAmount.toFixed(2)} บาท`,
            link: "/commissions",
            dedupeBaseKey: `commission.due:${cm.id}`,
            context: {},
          }),
        );
      }
    }

    if (ruleMap.has("approval.pending")) {
      const [pendingBookings, pendingCommissions, pendingListings] = await Promise.all([
        this.prisma.booking.count({ where: { status: "PENDING_PAYMENT" } }),
        this.prisma.commission.count({ where: { status: { in: ["PENDING_CALC", "PENDING_REVIEW"] } } }),
        this.prisma.listing.count({ where: { status: "PENDING_APPROVAL", archivedAt: null } }),
      ]);
      const totalPending = pendingBookings + pendingCommissions + pendingListings;
      if (totalPending > 0) {
        const dateKey = now.toISOString().slice(0, 10);
        tally(
          await this.dispatcher.dispatchEvent({
            event: "approval.pending",
            title: `สรุปรายการรออนุมัติประจำวัน (${dateKey})`,
            body: `รออนุมัติทั้งหมด ${totalPending} รายการ (จอง ${pendingBookings}, ค่านายหน้า ${pendingCommissions}, ประกาศ ${pendingListings})`,
            link: "/commissions",
            dedupeBaseKey: `approval.pending:digest:${dateKey}`,
            context: {},
          }),
        );
      }
    }

    return { now: now.toISOString(), totalSent, totalSkippedDuplicate };
  }
}
