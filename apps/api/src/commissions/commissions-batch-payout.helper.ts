import { BadRequestException, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@rrs/db";
import { fromSatang, toSatang, type Scope } from "@rrs/shared";
import type { AuthUser } from "../auth/auth.types";
import type { PrismaService } from "../prisma/prisma.service";
import type { CreateCommissionPayoutDto, PayCommissionPayoutDto } from "./commissions.types";

const PAYOUT_INCLUDE = {
  user: { select: { id: true, fullName: true, isFreelance: true } },
  proofFile: { select: { id: true, originalName: true, mimeType: true } },
  splits: {
    include: {
      commission: {
        select: {
          id: true,
          status: true,
          ownershipType: true,
          assetId: true,
          contractId: true,
          saleDealId: true,
          asset: { select: { id: true, code: true, unitNo: true } },
          contract: { select: { id: true, contractNo: true } },
          saleDeal: { select: { id: true, code: true } },
        },
      },
    },
  },
} satisfies Prisma.CommissionPayoutInclude;

async function executePayoutPaymentTx(
  tx: Prisma.TransactionClient,
  payoutId: string,
  input: PayCommissionPayoutDto,
  actorId: string,
) {
  const payout = await tx.commissionPayout.findUnique({
    where: { id: payoutId },
    include: PAYOUT_INCLUDE,
  });
  if (!payout) throw new NotFoundException({ code: "PAYOUT_NOT_FOUND", message: "ไม่พบรอบจ่ายค่านายหน้า" });
  if (payout.status === "PAID") {
    throw new BadRequestException({ code: "PAYOUT_ALREADY_PAID", message: "รอบจ่ายนี้บันทึกจ่ายเงินแล้ว" });
  }

  const paidAt = input.paidAt ? new Date(input.paidAt) : new Date();
  await tx.commissionPayout.update({
    where: { id: payoutId },
    data: {
      status: "PAID",
      paidAt,
      method: input.method,
      proofFileId: input.proofFileId ?? payout.proofFileId,
      note: input.note !== undefined ? input.note : payout.note,
    },
  });

  for (const s of payout.splits) {
    if (toSatang(s.netAmount) > 0n) {
      await tx.payment.create({
        data: {
          type: "COMMISSION_FROM_OWNER",
          direction: "OUT",
          amount: s.netAmount.toString(),
          paidAt,
          method: input.method,
          assetId: s.commission.assetId,
          contractId: s.commission.contractId,
          saleDealId: s.commission.saleDealId,
          commissionId: s.commissionId,
          receivedById: actorId,
          proofFileId: input.proofFileId ?? payout.proofFileId ?? null,
          note: input.note ?? `จ่ายส่วนแบ่งค่านายหน้า (${payout.periodLabel})`,
          createdById: actorId,
        },
      });
    }
  }

  const commissionIds = Array.from(new Set(payout.splits.map((s) => s.commissionId)));
  for (const cid of commissionIds) {
    const com = await tx.commission.findUnique({
      where: { id: cid },
      include: { splits: { include: { payout: true } } },
    });
    if (!com) continue;
    const activeAgentSplits = com.splits.filter((s) => s.revision === com.currentRevision && s.role !== "COMPANY");
    const allPaid =
      activeAgentSplits.length > 0 &&
      activeAgentSplits.every((s) => s.payoutId === payoutId || s.payout?.status === "PAID");
    await tx.commission.update({
      where: { id: cid },
      data: { status: allPaid ? "PAID" : "AWAITING_PAYOUT", updatedById: actorId },
    });
  }
}

export async function createPayoutTx(prisma: PrismaService, input: CreateCommissionPayoutDto, actorId: string) {
  const splits = await prisma.commissionSplit.findMany({
    where: { id: { in: input.splitIds } },
    include: {
      commission: {
        select: { id: true, currentRevision: true, status: true, ownershipType: true },
      },
    },
  });

  if (splits.length !== input.splitIds.length) {
    throw new BadRequestException({ code: "INVALID_SPLITS", message: "ไม่พบรายการส่วนแบ่งบางรายการ" });
  }

  let totalSatang = 0n;
  for (const s of splits) {
    if (s.userId !== input.userId || s.role === "COMPANY") {
      throw new BadRequestException({ code: "SPLIT_USER_MISMATCH", message: "ส่วนแบ่งไม่ตรงกับผู้รับเงินที่เลือก" });
    }
    if (s.revision !== s.commission.currentRevision) {
      throw new BadRequestException({ code: "STALE_SPLIT_REVISION", message: "ส่วนแบ่งไม่ใช่ฉบับปัจจุบันที่อนุมัติ" });
    }
    if (s.payoutId !== null) {
      throw new BadRequestException({ code: "SPLIT_ALREADY_ASSIGNED", message: "ส่วนแบ่งนี้ผูกกับรอบจ่ายอื่นแล้ว" });
    }
    const st = s.commission.status;
    if (s.commission.ownershipType === "AGENT" && !["RECEIVED", "AWAITING_PAYOUT"].includes(st)) {
      throw new BadRequestException({
        code: "OWNER_PAYMENT_NOT_RECEIVED",
        message: "ห้องฝากดูแล (AGENT) ต้องรับเงินจากเจ้าของห้องก่อนจ่ายส่วนแบ่ง Agent",
      });
    }
    if (s.commission.ownershipType === "OWNER" && !["APPROVED", "AWAITING_PAYOUT"].includes(st)) {
      throw new BadRequestException({
        code: "COMMISSION_NOT_APPROVED",
        message: "ต้องอนุมัติค่านายหน้าก่อนสร้างรอบจ่ายส่วนแบ่ง Agent",
      });
    }
    totalSatang += toSatang(s.netAmount);
  }

  const payoutId = await prisma.$transaction(async (tx) => {
    const created = await tx.commissionPayout.create({
      data: {
        userId: input.userId,
        periodLabel: input.periodLabel.trim(),
        totalAmount: fromSatang(totalSatang),
        status: "PENDING",
        proofFileId: input.proofFileId ?? null,
        note: input.note ?? null,
        createdById: actorId,
      },
    });
    await tx.commissionSplit.updateMany({
      where: { id: { in: input.splitIds } },
      data: { payoutId: created.id },
    });
    const cids = Array.from(new Set(splits.map((s) => s.commissionId)));
    await tx.commission.updateMany({
      where: { id: { in: cids }, status: { not: "PAID" } },
      data: { status: "AWAITING_PAYOUT", updatedById: actorId },
    });
    if (input.payImmediately) {
      await executePayoutPaymentTx(
        tx,
        created.id,
        {
          paidAt: input.paidAt,
          method: input.method ?? "BANK_TRANSFER",
          proofFileId: input.proofFileId,
          note: input.note,
        },
        actorId,
      );
    }
    return created.id;
  });

  const row = await prisma.commissionPayout.findUniqueOrThrow({ where: { id: payoutId }, include: PAYOUT_INCLUDE });
  return { ...row, totalAmount: fromSatang(toSatang(row.totalAmount)) };
}

export async function payPayoutTx(
  prisma: PrismaService,
  payoutId: string,
  input: PayCommissionPayoutDto,
  actorId: string,
) {
  await prisma.$transaction((tx) => executePayoutPaymentTx(tx, payoutId, input, actorId));
  const row = await prisma.commissionPayout.findUniqueOrThrow({ where: { id: payoutId }, include: PAYOUT_INCLUDE });
  return { ...row, totalAmount: fromSatang(toSatang(row.totalAmount)) };
}

export async function listPayoutsHelper(prisma: PrismaService, user: AuthUser, scope: Scope) {
  const rows = await prisma.commissionPayout.findMany({
    where:
      scope === "OWN" ? { userId: user.id } : scope === "TEAM" ? { user: { teamId: user.teamId ?? "__none__" } } : {},
    include: PAYOUT_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => ({ ...r, totalAmount: fromSatang(toSatang(r.totalAmount)) }));
}
