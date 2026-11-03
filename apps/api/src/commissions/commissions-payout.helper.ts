import { BadRequestException } from "@nestjs/common";
import type { CommissionStatus, Prisma } from "@rrs/db";
import { fromSatang, toSatang } from "@rrs/shared";
import type { PrismaService } from "../prisma/prisma.service";
import type { CommissionWithInclude } from "./commissions-query.helper";
import type { ApproveCommissionDto, ReceiveOwnerPaymentDto } from "./commissions.types";

export async function approveCommissionTx(
  prisma: PrismaService,
  existing: CommissionWithInclude,
  input: ApproveCommissionDto,
  actorId: string,
) {
  const currentSplits = existing.splits.filter((s) => s.revision === existing.currentRevision);
  if (currentSplits.length === 0) {
    throw new BadRequestException({
      code: "SPLITS_REQUIRED",
      message: "กรุณาคำนวณและบันทึกส่วนแบ่งค่านายหน้าก่อนอนุมัติ",
    });
  }
  if (existing.status === "PAID" || existing.status === "CANCELLED") {
    throw new BadRequestException({
      code: "INVALID_COMMISSION_STATUS",
      message: "ไม่สามารถอนุมัติรายการที่จ่ายแล้วหรือยกเลิกแล้วได้",
    });
  }

  const now = new Date();
  const nextStatus: CommissionStatus =
    existing.ownershipType === "OWNER"
      ? "AWAITING_PAYOUT"
      : input.ownerPaymentDueAt || existing.ownerPaymentDueAt
        ? "AWAITING_OWNER_PAYMENT"
        : "APPROVED";

  const existingRev = existing.revisions.find((r) => r.revision === existing.currentRevision);

  await prisma.$transaction(async (tx) => {
    if (existingRev) {
      if (!existingRev.approvedAt) {
        await tx.commissionRevision.update({
          where: { id: existingRev.id },
          data: { approvedById: actorId, approvedAt: now },
        });
      }
    } else {
      await tx.commissionRevision.create({
        data: {
          commissionId: existing.id,
          revision: existing.currentRevision,
          createdById: actorId,
          approvedById: actorId,
          approvedAt: now,
          snapshot: {
            formula: existing.formula,
            params: existing.params,
            baseAmount: fromSatang(toSatang(existing.baseAmount)),
            termMonths: existing.termMonths,
            totalAmount: fromSatang(toSatang(existing.totalAmount)),
            splits: currentSplits.map((s) => ({
              role: s.role,
              userId: s.userId,
              shareType: s.shareType,
              sharePercent: s.sharePercent !== null ? fromSatang(toSatang(s.sharePercent)) : null,
              amount: fromSatang(toSatang(s.amount)),
              withholdingTax: fromSatang(toSatang(s.withholdingTax)),
              netAmount: fromSatang(toSatang(s.netAmount)),
            })),
          } as Prisma.InputJsonValue,
        },
      });
    }

    await tx.commission.update({
      where: { id: existing.id },
      data: {
        status: nextStatus,
        approvedById: actorId,
        approvedAt: now,
        ownerPaymentDueAt: input.ownerPaymentDueAt ? new Date(input.ownerPaymentDueAt) : existing.ownerPaymentDueAt,
        note: input.note !== undefined ? input.note : existing.note,
        updatedById: actorId,
      },
    });
  });

  return { nextStatus, revision: existing.currentRevision };
}

export async function receiveOwnerPaymentTx(
  prisma: PrismaService,
  existing: CommissionWithInclude,
  input: ReceiveOwnerPaymentDto,
  actorId: string,
) {
  if (existing.ownershipType === "OWNER") {
    throw new BadRequestException({
      code: "OWNER_ASSET_SKIPS_RECEIPT",
      message: "ห้องของบริษัท (OWNER) ข้ามขั้นตอนรับเงินจากเจ้าของห้อง",
    });
  }
  if (!["APPROVED", "AWAITING_OWNER_PAYMENT"].includes(existing.status)) {
    throw new BadRequestException({
      code: "COMMISSION_NOT_APPROVED",
      message: "ต้องอนุมัติค่านายหน้าก่อนบันทึกรับเงินจากเจ้าของห้อง",
    });
  }

  const paidAt = input.paidAt ? new Date(input.paidAt) : new Date();
  const amount = input.amount ?? existing.totalAmount.toString();

  const payment = await prisma.$transaction(async (tx) => {
    const p = await tx.payment.create({
      data: {
        type: "COMMISSION_FROM_OWNER",
        direction: "IN",
        amount,
        paidAt,
        method: input.method,
        reference: input.reference ?? null,
        assetId: existing.assetId,
        contractId: existing.contractId,
        saleDealId: existing.saleDealId,
        commissionId: existing.id,
        receivedById: actorId,
        proofFileId: input.proofFileId ?? null,
        note: input.note ?? null,
        createdById: actorId,
      },
    });
    await tx.commission.update({
      where: { id: existing.id },
      data: { status: "RECEIVED", receivedAt: paidAt, updatedById: actorId },
    });
    return p;
  });

  return payment;
}
