import type { Prisma } from "@rrs/db";

export const SALE_DEAL_INCLUDE = {
  lead: { select: { id: true, code: true, fullName: true, phone: true, status: true } },
  asset: {
    select: {
      id: true,
      code: true,
      category: true,
      ownershipType: true,
      unitNo: true,
      salePrice: true,
      status: true,
      project: { select: { id: true, name: true } },
    },
  },
  owner: { select: { id: true, code: true, fullName: true } },
  agent: { select: { id: true, fullName: true, nickname: true } },
  commission: {
    select: { id: true, status: true, formula: true, baseAmount: true, totalAmount: true },
  },
} satisfies Prisma.SaleDealInclude;

export async function syncSaleSideEffectsTx(
  tx: Prisma.TransactionClient,
  deal: Prisma.SaleDealGetPayload<Record<string, never>>,
  ownershipType: "OWNER" | "AGENT",
  fallbackSalePrice: number,
  actorId: string,
): Promise<void> {
  if (deal.stage === "TRANSFERRED" || deal.stage === "CLOSED") {
    await tx.lead.update({
      where: { id: deal.leadId },
      data: { status: "CLOSED_WON", updatedById: actorId },
    });
    const existingCom = await tx.commission.findUnique({ where: { saleDealId: deal.id } });
    const baseAmount = deal.agreedPrice ?? deal.offeredPrice ?? deal.askingPrice ?? fallbackSalePrice;
    if (!existingCom) {
      await tx.commission.create({
        data: {
          saleDealId: deal.id,
          assetId: deal.assetId,
          ownershipType,
          formula: deal.commissionFormula ?? "PERCENT_SALE_PRICE",
          params: (deal.commissionParams ?? { percent: 3 }) as Prisma.InputJsonValue,
          baseAmount,
          totalAmount: 0,
          status: "PENDING_CALC",
          createdById: actorId,
          updatedById: actorId,
        },
      });
    }
  }
}
