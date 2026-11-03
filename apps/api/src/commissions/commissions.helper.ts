import { BadRequestException } from "@nestjs/common";
import { calculateCommission, validateSplits, type SplitInputItem } from "@rrs/commission";
import type { Prisma } from "@rrs/db";
import type { PrismaService } from "../prisma/prisma.service";
import type { CommissionWithInclude } from "./commissions-query.helper";
import type { CalculateCommissionSplitsDto } from "./commissions.types";

export async function calculateAndSaveSplitsTx(
  prisma: PrismaService,
  existing: CommissionWithInclude,
  input: CalculateCommissionSplitsDto,
  actorId: string,
) {
  const hasApprovedRevision =
    existing.revisions.some((r) => r.approvedAt !== null) ||
    ["APPROVED", "AWAITING_OWNER_PAYMENT", "RECEIVED", "AWAITING_PAYOUT", "PAID"].includes(existing.status);

  const reason = input.reason?.trim() ?? "";
  if (hasApprovedRevision && !reason) {
    throw new BadRequestException({
      code: "REVISION_REASON_REQUIRED",
      message: "การแก้ไขค่านายหน้าหลังอนุมัติต้องระบุเหตุผลในการปรับปรุงเสมอ",
    });
  }

  for (const s of input.splits) {
    if (s.role !== "COMPANY" && !s.userId) {
      throw new BadRequestException({
        code: "AGENT_REQUIRED",
        message: `บทบาท ${s.role} ต้องระบุผู้รับส่วนแบ่ง (userId)`,
      });
    }
  }

  const userIds = Array.from(new Set(input.splits.map((s) => s.userId).filter((id): id is string => Boolean(id))));
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, isFreelance: true } })
    : [];
  const freelanceByUser = new Map(users.map((u) => [u.id, u.isFreelance]));

  const baseAmount = input.baseAmount ?? existing.baseAmount.toString();
  const termMonths = input.termMonths ?? existing.termMonths ?? 12;
  const splitInputs: SplitInputItem[] = input.splits.map((s) => ({
    role: s.role,
    userId: s.role === "COMPANY" ? null : (s.userId ?? null),
    shareType: s.shareType,
    sharePercent: s.sharePercent ?? null,
    amount: s.amount ?? null,
    isFreelance: s.userId ? (freelanceByUser.get(s.userId) ?? false) : false,
    withholdingRatePercent: s.withholdingRatePercent ?? null,
  }));

  let computed;
  try {
    computed = calculateCommission({
      formula: input.formula,
      baseAmount,
      termMonths,
      params: input.params ?? {},
      splits: splitInputs,
    });
  } catch (err) {
    const val = validateSplits(baseAmount, splitInputs);
    throw new BadRequestException({
      code: "INVALID_COMMISSION_SPLITS",
      message: err instanceof Error ? err.message : "ข้อมูลการแบ่งค่านายหน้าไม่ถูกต้อง",
      details: val.errors,
    });
  }

  const maxRevision = existing.revisions.reduce((max, r) => Math.max(max, r.revision), existing.currentRevision);
  const targetRevision = hasApprovedRevision ? maxRevision + 1 : existing.currentRevision;

  await prisma.$transaction(async (tx) => {
    if (!hasApprovedRevision) {
      await tx.commissionSplit.deleteMany({ where: { commissionId: existing.id, revision: targetRevision } });
    }
    await tx.commissionSplit.createMany({
      data: computed.splits.map((s) => ({
        commissionId: existing.id,
        revision: targetRevision,
        role: s.role,
        userId: s.userId,
        shareType: s.shareType,
        sharePercent: s.sharePercent,
        amount: s.amount,
        withholdingTax: s.withholdingTax,
        netAmount: s.netAmount,
      })),
    });

    if (hasApprovedRevision) {
      await tx.commissionRevision.create({
        data: {
          commissionId: existing.id,
          revision: targetRevision,
          reason,
          createdById: actorId,
          snapshot: {
            formula: input.formula,
            params: input.params ?? {},
            baseAmount,
            termMonths,
            totalAmount: computed.totalAmount,
            splits: computed.splits.map((s) => ({
              role: s.role,
              userId: s.userId,
              shareType: s.shareType,
              sharePercent: s.sharePercent,
              amount: s.amount,
              withholdingTax: s.withholdingTax,
              netAmount: s.netAmount,
            })),
          } as Prisma.InputJsonValue,
        },
      });
    }

    await tx.commission.update({
      where: { id: existing.id },
      data: {
        formula: input.formula,
        params: (input.params ?? {}) as Prisma.InputJsonValue,
        baseAmount,
        termMonths,
        totalAmount: computed.totalAmount,
        currentRevision: targetRevision,
        status: "PENDING_REVIEW",
        approvedById: null,
        approvedAt: null,
        updatedById: actorId,
      },
    });
  });

  return { targetRevision, totalAmount: computed.totalAmount, hasApprovedRevision };
}
