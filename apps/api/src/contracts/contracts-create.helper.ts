import { BadRequestException, NotFoundException } from "@nestjs/common";
import { nextCode, type Prisma } from "@rrs/db";
import type { PrismaService } from "../prisma/prisma.service";
import { type ContractWithInclude, ensureContractCommissionTx } from "./contracts.helper";
import type { CreateContractDto, RenewContractDto, ReviseContractDto } from "./contracts.types";

export async function updateDraftContract(
  prisma: PrismaService,
  id: string,
  input: ReviseContractDto,
  actorId: string,
): Promise<void> {
  await prisma.contract.update({
    where: { id },
    data: {
      ...(input.monthlyRent !== undefined ? { monthlyRent: input.monthlyRent } : {}),
      ...(input.securityDeposit !== undefined ? { securityDeposit: input.securityDeposit } : {}),
      ...(input.advanceRent !== undefined ? { advanceRent: input.advanceRent } : {}),
      ...(input.startDate ? { startDate: new Date(input.startDate) } : {}),
      ...(input.endDate ? { endDate: new Date(input.endDate) } : {}),
      ...(input.reminderDays ? { reminderDays: input.reminderDays } : {}),
      ...(input.commissionFormula ? { commissionFormula: input.commissionFormula } : {}),
      ...(input.commissionParams ? { commissionParams: input.commissionParams as Prisma.InputJsonValue } : {}),
      ...(input.fileId !== undefined ? { fileId: input.fileId } : {}),
      ...(input.note !== undefined ? { note: input.note } : {}),
      updatedById: actorId,
    },
  });
}

export function buildRenewDto(existing: ContractWithInclude, input: RenewContractDto): CreateContractDto {
  return {
    previousContractId: existing.id,
    assetId: existing.assetId,
    leadId: existing.leadId,
    monthlyRent: input.monthlyRent ?? Number(existing.monthlyRent),
    securityDeposit: input.securityDeposit ?? Number(existing.securityDeposit),
    advanceRent: input.advanceRent ?? Number(existing.advanceRent),
    startDate: input.startDate,
    endDate: input.endDate,
    status: input.activateImmediately ? "ACTIVE" : "DRAFT",
    reminderDays: existing.reminderDays,
    commissionFormula: existing.commissionFormula ?? "ONE_MONTH",
    commissionParams: (existing.commissionParams as Record<string, unknown> | null) ?? {},
    fileId: input.fileId ?? null,
    note: input.note ?? null,
    parties: existing.parties.map((p) => ({
      partyType: p.partyType,
      fullName: p.fullName,
      idNumber: p.idNumber,
      phone: p.phone,
      email: p.email,
    })),
  };
}

export async function createContractRecordTx(
  prisma: PrismaService,
  input: CreateContractDto,
  actorId: string,
): Promise<{ contractId: string; assetId: string; isActive: boolean }> {
  const booking = input.bookingId ? await prisma.booking.findUnique({ where: { id: input.bookingId } }) : null;
  if (input.bookingId && !booking) {
    throw new NotFoundException({ code: "BOOKING_NOT_FOUND", message: "ไม่พบข้อมูลการจอง" });
  }
  if (booking && booking.status !== "PAID") {
    throw new BadRequestException({
      code: "BOOKING_NOT_PAID",
      message: "การจองต้องชำระเงินแล้วเท่านั้นจึงจะแปลงเป็นสัญญาได้",
    });
  }

  const prevContract = input.previousContractId
    ? await prisma.contract.findUnique({ where: { id: input.previousContractId } })
    : null;

  const assetId = input.assetId ?? booking?.assetId ?? prevContract?.assetId;
  const leadId = input.leadId ?? booking?.leadId ?? prevContract?.leadId;
  if (!assetId || !leadId) {
    throw new BadRequestException({
      code: "MISSING_CONTRACT_PARTIES",
      message: "กรุณาระบุทรัพย์สินและลูกค้าสำหรับสัญญาเช่า",
    });
  }

  const [asset, lead] = await Promise.all([
    prisma.asset.findFirst({ where: { id: assetId, archivedAt: null } }),
    prisma.lead.findFirst({ where: { id: leadId, archivedAt: null } }),
  ]);
  if (!asset) throw new NotFoundException({ code: "ASSET_NOT_FOUND", message: "ไม่พบทรัพย์สิน" });
  if (!lead) throw new NotFoundException({ code: "LEAD_NOT_FOUND", message: "ไม่พบข้อมูลลูกค้า" });

  const startDate = input.startDate
    ? new Date(input.startDate)
    : (booking?.startDate ?? prevContract?.startDate ?? new Date());
  const endDate = input.endDate
    ? new Date(input.endDate)
    : (booking?.endDate ?? prevContract?.endDate ?? new Date(Date.now() + 365 * 86400_000));
  if (endDate.getTime() < startDate.getTime()) {
    throw new BadRequestException({
      code: "INVALID_DATE_RANGE",
      message: "วันที่สิ้นสุดสัญญาต้องไม่น้อยกว่าวันที่เริ่มสัญญา",
    });
  }

  const monthlyRent =
    input.monthlyRent ?? Number(booking?.monthlyRent ?? prevContract?.monthlyRent ?? asset.rentPrice ?? 0);
  if (monthlyRent <= 0) {
    throw new BadRequestException({ code: "INVALID_RENT", message: "ค่าเช่าต่อเดือนต้องมากกว่า 0" });
  }

  const year = startDate.getUTCFullYear();
  const isActive = input.status === "ACTIVE";
  const defaultParties =
    input.parties && input.parties.length > 0
      ? input.parties
      : [{ partyType: "TENANT" as const, fullName: lead.fullName, phone: lead.phone, email: lead.email }];

  const created = await prisma.$transaction(async (tx) => {
    const contractNo = await nextCode(tx, `LS-${year}`, `LS-${year}-`, 4);
    const c = await tx.contract.create({
      data: {
        contractNo,
        revision: 1,
        bookingId: booking?.id ?? null,
        previousContractId: prevContract?.id ?? null,
        assetId: asset.id,
        leadId: lead.id,
        ownerId: asset.ownerId,
        monthlyRent,
        securityDeposit:
          input.securityDeposit ?? Number(booking?.securityDeposit ?? prevContract?.securityDeposit ?? 0),
        advanceRent: input.advanceRent ?? Number(booking?.advanceRent ?? prevContract?.advanceRent ?? 0),
        startDate,
        endDate,
        status: input.status ?? "DRAFT",
        signedAt: isActive ? new Date() : null,
        reminderDays: input.reminderDays ?? [90, 60, 30],
        commissionFormula: input.commissionFormula ?? "ONE_MONTH",
        commissionParams: (input.commissionParams ?? {}) as Prisma.InputJsonValue,
        fileId: input.fileId ?? null,
        note: input.note ?? null,
        createdById: actorId,
        updatedById: actorId,
        parties: { create: defaultParties },
      },
    });
    if (booking) {
      await tx.booking.update({
        where: { id: booking.id },
        data: { status: "CONVERTED", updatedById: actorId },
      });
    }
    if (isActive) {
      await tx.lead.update({
        where: { id: lead.id },
        data: { status: "CONTRACTED", updatedById: actorId },
      });
      await ensureContractCommissionTx(tx, c, asset.ownershipType, actorId);
    }
    return c;
  });

  return { contractId: created.id, assetId: asset.id, isActive };
}

export async function markExpiredContracts(prisma: PrismaService, asOfDate?: string) {
  const cutoff = asOfDate ? new Date(asOfDate) : new Date();
  cutoff.setUTCHours(0, 0, 0, 0);
  const expired = await prisma.contract.findMany({
    where: { status: "ACTIVE", endDate: { lt: cutoff } },
    select: { id: true, assetId: true },
  });
  if (expired.length === 0) return { expiredCount: 0, assetIds: [] as string[] };
  await prisma.contract.updateMany({
    where: { id: { in: expired.map((c) => c.id) } },
    data: { status: "ENDED" },
  });
  return { expiredCount: expired.length, assetIds: Array.from(new Set(expired.map((c) => c.assetId))) };
}
