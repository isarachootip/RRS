import { NotFoundException } from "@nestjs/common";
import { fromSatang, toSatang } from "@rrs/shared";
import type { PrismaService } from "../prisma/prisma.service";
import type { CreateExpenseDto, CreatePaymentDto } from "./finance.types";
import { recomputeRentScheduleFromPaymentsTx } from "./rent-schedules.helper";

export function monthDateRange(year?: number, month?: number): { gte: Date; lt: Date } | undefined {
  if (!year) return undefined;
  if (month) {
    return {
      gte: new Date(Date.UTC(year, month - 1, 1, 0, 0, 0)),
      lt: new Date(Date.UTC(year, month, 1, 0, 0, 0)),
    };
  }
  return {
    gte: new Date(Date.UTC(year, 0, 1, 0, 0, 0)),
    lt: new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0)),
  };
}

export async function resolvePaymentLinks(prisma: PrismaService, input: CreatePaymentDto) {
  let assetId = input.assetId ?? null;
  let contractId = input.contractId ?? null;
  if (input.rentScheduleId) {
    const sched = await prisma.rentSchedule.findUnique({
      where: { id: input.rentScheduleId },
      include: { contract: { select: { id: true, assetId: true } } },
    });
    if (!sched) throw new NotFoundException({ code: "NOT_FOUND", message: "ไม่พบงวดค่าเช่าที่ระบุ" });
    contractId = contractId ?? sched.contract.id;
    assetId = assetId ?? sched.contract.assetId;
  } else if (contractId && !assetId) {
    const c = await prisma.contract.findUnique({ where: { id: contractId }, select: { assetId: true } });
    assetId = c?.assetId ?? null;
  } else if (input.bookingId && !assetId) {
    const b = await prisma.booking.findUnique({ where: { id: input.bookingId }, select: { assetId: true } });
    assetId = b?.assetId ?? null;
  } else if (input.saleDealId && !assetId) {
    const s = await prisma.saleDeal.findUnique({ where: { id: input.saleDealId }, select: { assetId: true } });
    assetId = s?.assetId ?? null;
  }
  return { assetId, contractId };
}

export async function createPaymentTx(prisma: PrismaService, input: CreatePaymentDto, actorId: string) {
  const amountStr = fromSatang(toSatang(input.amount));
  const direction = input.direction ?? (input.type === "REFUND" ? "OUT" : "IN");
  const { assetId, contractId } = await resolvePaymentLinks(prisma, input);
  const receivedById = input.receivedById ?? actorId;

  const created = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        type: input.type,
        direction,
        amount: amountStr,
        paidAt: new Date(input.paidAt),
        method: input.method,
        reference: input.reference ?? null,
        assetId,
        bookingId: input.bookingId ?? null,
        contractId,
        saleDealId: input.saleDealId ?? null,
        rentScheduleId: input.rentScheduleId ?? null,
        commissionId: input.commissionId ?? null,
        receivedById,
        proofFileId: input.proofFileId ?? null,
        note: input.note ?? null,
        createdById: actorId,
      },
      include: {
        asset: { select: { id: true, code: true, unitNo: true, ownershipType: true } },
        receivedBy: { select: { id: true, fullName: true } },
        rentSchedule: true,
      },
    });
    if (payment.rentScheduleId) {
      const updatedSchedule = await recomputeRentScheduleFromPaymentsTx(tx, payment.rentScheduleId);
      return { ...payment, rentSchedule: updatedSchedule };
    }
    return payment;
  });

  return { created, amountStr, receivedById };
}

export async function createExpenseRecord(prisma: PrismaService, input: CreateExpenseDto, actorId: string) {
  const amountStr = fromSatang(toSatang(input.amount));
  const incurredAt = new Date(input.incurredAt);
  const paidAt = input.paidAt === null ? null : input.paidAt ? new Date(input.paidAt) : incurredAt;
  const created = await prisma.expense.create({
    data: {
      assetId: input.assetId,
      category: input.category,
      amount: amountStr,
      incurredAt,
      paidAt,
      vendor: input.vendor ?? null,
      proofFileId: input.proofFileId ?? null,
      note: input.note ?? null,
      createdById: actorId,
    },
    include: { asset: { select: { id: true, code: true, unitNo: true, ownershipType: true } } },
  });
  return { created, amountStr };
}
