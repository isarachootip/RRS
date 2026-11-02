import { ConflictException } from "@nestjs/common";
import { isPeriodOverlapError, type Prisma } from "@rrs/db";
import type { PrismaService } from "../prisma/prisma.service";
import type { CancelBookingDto, PayBookingDto } from "./bookings.types";

export const BOOKING_INCLUDE = {
  lead: { select: { id: true, code: true, fullName: true, phone: true, status: true } },
  asset: {
    select: {
      id: true,
      code: true,
      category: true,
      unitNo: true,
      rentPrice: true,
      status: true,
      project: { select: { id: true, name: true } },
    },
  },
  receivedBy: { select: { id: true, fullName: true, nickname: true } },
  payments: {
    where: { archivedAt: null },
    orderBy: { paidAt: "desc" as const },
    select: {
      id: true,
      type: true,
      direction: true,
      amount: true,
      paidAt: true,
      method: true,
      reference: true,
      proofFileId: true,
    },
  },
} satisfies Prisma.BookingInclude;

export async function payBookingTx(
  prisma: PrismaService,
  id: string,
  leadId: string,
  assetId: string,
  bookingFee: Prisma.Decimal,
  paidAt: Date,
  receivedById: string,
  actorId: string,
  input: PayBookingDto,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id },
      data: { status: "PAID", paidAt, receivedById, updatedById: actorId },
    });
    await tx.payment.create({
      data: {
        type: "BOOKING_FEE",
        direction: "IN",
        amount: bookingFee,
        paidAt,
        method: input.method ?? "BANK_TRANSFER",
        reference: input.reference ?? null,
        assetId,
        bookingId: id,
        receivedById,
        proofFileId: input.proofFileId ?? null,
        note: input.note ?? null,
        createdById: actorId,
      },
    });
    await tx.lead.update({
      where: { id: leadId },
      data: { status: "BOOKED", updatedById: actorId },
    });
  });
}

export async function cancelBookingTx(
  prisma: PrismaService,
  id: string,
  assetId: string,
  previousStatus: string,
  bookingFee: Prisma.Decimal,
  actorId: string,
  input: CancelBookingDto,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id },
      data: {
        status: "CANCELLED",
        cancelReason: input.cancelReason,
        feeForfeited: input.feeForfeited,
        updatedById: actorId,
      },
    });
    if (previousStatus === "PAID" && !input.feeForfeited && Number(bookingFee) > 0) {
      await tx.payment.create({
        data: {
          type: "REFUND",
          direction: "OUT",
          amount: bookingFee,
          paidAt: new Date(),
          method: "BANK_TRANSFER",
          assetId,
          bookingId: id,
          note: `คืนเงินจอง: ${input.cancelReason}`,
          createdById: actorId,
        },
      });
    }
  });
}

/**
 * แปลง EXCLUDE / trigger error จาก PostgreSQL เป็น 409 PERIOD_OVERLAP พร้อมรหัสการจอง/สัญญาที่ชนกัน
 */
export async function throwIfPeriodOverlap(
  prisma: PrismaService,
  err: unknown,
  assetId: string,
  startDate: Date,
  endDate: Date,
): Promise<void> {
  if (!isPeriodOverlapError(err)) return;
  const [conflictBooking, conflictContract] = await Promise.all([
    prisma.booking.findFirst({
      where: {
        assetId,
        status: { in: ["PAID", "CONVERTED"] },
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      select: { id: true, code: true },
    }),
    prisma.contract.findFirst({
      where: {
        assetId,
        status: "ACTIVE",
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      select: { id: true, contractNo: true },
    }),
  ]);
  const conflictingCode = conflictBooking?.code ?? conflictContract?.contractNo ?? null;
  const message = conflictingCode
    ? `ห้องนี้มีการจองหรือสัญญาในช่วงวันที่นี้แล้ว (ชนกับ ${conflictingCode})`
    : "ห้องนี้มีการจองหรือสัญญาในช่วงวันที่นี้แล้ว";
  throw new ConflictException({
    code: "PERIOD_OVERLAP",
    message,
    details: {
      conflictingCode,
      conflictingBookingId: conflictBooking?.id ?? null,
      conflictingContractId: conflictContract?.id ?? null,
    },
  });
}
