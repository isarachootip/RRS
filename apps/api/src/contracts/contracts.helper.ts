import type { CommissionFormula, OwnershipType, Prisma } from "@rrs/db";
import type { PrismaService } from "../prisma/prisma.service";
import type { ReviseContractDto, SignContractDto } from "./contracts.types";

export const CONTRACT_INCLUDE = {
  lead: { select: { id: true, code: true, fullName: true, phone: true, status: true } },
  asset: {
    select: {
      id: true,
      code: true,
      category: true,
      ownershipType: true,
      unitNo: true,
      rentPrice: true,
      status: true,
      project: { select: { id: true, name: true } },
    },
  },
  owner: { select: { id: true, code: true, fullName: true } },
  booking: { select: { id: true, code: true, status: true } },
  revisionOf: { select: { id: true, contractNo: true, revision: true } },
  previousContract: { select: { id: true, contractNo: true, startDate: true, endDate: true } },
  parties: true,
  commission: {
    select: {
      id: true,
      status: true,
      formula: true,
      baseAmount: true,
      termMonths: true,
      totalAmount: true,
    },
  },
} satisfies Prisma.ContractInclude;

export type ContractWithInclude = Prisma.ContractGetPayload<{ include: typeof CONTRACT_INCLUDE }>;

export function calculateTermMonths(startDate: Date, endDate: Date): number {
  const years = endDate.getUTCFullYear() - startDate.getUTCFullYear();
  const months = endDate.getUTCMonth() - startDate.getUTCMonth();
  const total = years * 12 + months + (endDate.getUTCDate() >= startDate.getUTCDate() ? 1 : 0);
  return Math.max(1, total);
}

export async function ensureContractCommissionTx(
  tx: Prisma.TransactionClient,
  contract: {
    id: string;
    assetId: string;
    monthlyRent: Prisma.Decimal;
    startDate: Date;
    endDate: Date;
    commissionFormula: CommissionFormula | null;
    commissionParams: Prisma.JsonValue;
  },
  ownershipType: OwnershipType,
  actorId: string,
  supersededContractId?: string,
): Promise<void> {
  const termMonths = calculateTermMonths(contract.startDate, contract.endDate);
  const formula = contract.commissionFormula ?? "ONE_MONTH";
  const params = (contract.commissionParams ?? {}) as Prisma.InputJsonValue;

  if (supersededContractId) {
    const oldCom = await tx.commission.findUnique({ where: { contractId: supersededContractId } });
    if (oldCom) {
      await tx.commission.update({
        where: { id: oldCom.id },
        data: {
          contractId: contract.id,
          baseAmount: contract.monthlyRent,
          termMonths,
          formula,
          params,
          updatedById: actorId,
        },
      });
      return;
    }
  }

  const existing = await tx.commission.findUnique({ where: { contractId: contract.id } });
  if (existing) return;

  await tx.commission.create({
    data: {
      contractId: contract.id,
      assetId: contract.assetId,
      ownershipType,
      formula,
      params,
      baseAmount: contract.monthlyRent,
      termMonths,
      totalAmount: 0,
      status: "PENDING_CALC",
      createdById: actorId,
      updatedById: actorId,
    },
  });
}

export async function reviseActiveContractTx(
  prisma: PrismaService,
  existing: ContractWithInclude,
  input: ReviseContractDto,
  actorId: string,
): Promise<string> {
  const nextRevision = existing.revision + 1;
  const baseNo = existing.contractNo.replace(/-R\d+$/, "");
  const nextContractNo = `${baseNo}-R${nextRevision}`;
  const startDate = input.startDate ? new Date(input.startDate) : existing.startDate;
  const endDate = input.endDate ? new Date(input.endDate) : existing.endDate;
  const partiesToCreate =
    input.parties ??
    existing.parties.map((p) => ({
      partyType: p.partyType,
      fullName: p.fullName,
      idNumber: p.idNumber,
      phone: p.phone,
      email: p.email,
    }));

  return prisma.$transaction(async (tx) => {
    await tx.contract.update({
      where: { id: existing.id },
      data: { status: "SUPERSEDED", updatedById: actorId },
    });
    const created = await tx.contract.create({
      data: {
        contractNo: nextContractNo,
        revision: nextRevision,
        revisionOfId: existing.id,
        previousContractId: existing.previousContractId,
        bookingId: existing.bookingId,
        assetId: existing.assetId,
        leadId: existing.leadId,
        ownerId: existing.ownerId,
        monthlyRent: input.monthlyRent ?? existing.monthlyRent,
        securityDeposit: input.securityDeposit ?? existing.securityDeposit,
        advanceRent: input.advanceRent ?? existing.advanceRent,
        startDate,
        endDate,
        status: "ACTIVE",
        signedAt: existing.signedAt ?? new Date(),
        reminderDays: input.reminderDays ?? existing.reminderDays,
        commissionFormula: input.commissionFormula ?? existing.commissionFormula ?? "ONE_MONTH",
        commissionParams: (input.commissionParams ?? existing.commissionParams ?? {}) as Prisma.InputJsonValue,
        fileId: input.fileId !== undefined ? input.fileId : existing.fileId,
        note: input.note !== undefined ? input.note : existing.note,
        createdById: actorId,
        updatedById: actorId,
        parties: { create: partiesToCreate },
      },
    });
    await ensureContractCommissionTx(tx, created, existing.asset.ownershipType, actorId, existing.id);
    return created.id;
  });
}

export async function signContractTx(
  prisma: PrismaService,
  existing: ContractWithInclude,
  signedAt: Date,
  input: SignContractDto,
  actorId: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const updated = await tx.contract.update({
      where: { id: existing.id },
      data: {
        status: "ACTIVE",
        signedAt,
        ...(input.fileId !== undefined ? { fileId: input.fileId } : {}),
        ...(input.commissionFormula ? { commissionFormula: input.commissionFormula } : {}),
        ...(input.commissionParams ? { commissionParams: input.commissionParams as Prisma.InputJsonValue } : {}),
        updatedById: actorId,
      },
    });
    await tx.lead.update({
      where: { id: existing.leadId },
      data: { status: "CONTRACTED", updatedById: actorId },
    });
    await ensureContractCommissionTx(tx, updated, existing.asset.ownershipType, actorId);
  });
}
