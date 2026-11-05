import type { PrismaService } from "../src/prisma/prisma.service";

export async function seedReportsDashboardDeals(
  prisma: PrismaService,
  ids: {
    sfx: number;
    compOwnerId: string;
    extOwnerId: string;
    ownerAssetId: string;
    agentRentAssetId: string;
    agentSaleAssetId: string;
    leadSuk1Id: string;
    leadSuk2Id: string;
    leadSilId: string;
    agSukId: string;
    agSilId: string;
  },
) {
  const cOwner = await prisma.contract.create({
    data: {
      contractNo: `LS-2026-8${String(ids.sfx).slice(-3)}`,
      assetId: ids.ownerAssetId,
      leadId: ids.leadSuk1Id,
      ownerId: ids.compOwnerId,
      monthlyRent: "25000.00",
      securityDeposit: "50000.00",
      advanceRent: "25000.00",
      startDate: new Date("2026-03-01T00:00:00.000Z"),
      endDate: new Date("2027-02-28T00:00:00.000Z"),
      status: "ACTIVE",
    },
  });

  const cAgent = await prisma.contract.create({
    data: {
      contractNo: `LS-2026-9${String(ids.sfx).slice(-3)}`,
      assetId: ids.agentRentAssetId,
      leadId: ids.leadSuk2Id,
      ownerId: ids.extOwnerId,
      monthlyRent: "30000.00",
      securityDeposit: "60000.00",
      advanceRent: "30000.00",
      startDate: new Date("2026-04-01T00:00:00.000Z"),
      endDate: new Date("2027-03-31T00:00:00.000Z"),
      status: "ACTIVE",
    },
  });

  const sDeal = await prisma.saleDeal.create({
    data: {
      code: `SD-16-${ids.sfx}`,
      assetId: ids.agentSaleAssetId,
      leadId: ids.leadSilId,
      ownerId: ids.extOwnerId,
      agentId: ids.agSilId,
      stage: "CLOSED",
      agreedPrice: "5000000.00",
      transferDate: new Date("2026-05-15T00:00:00.000Z"),
    },
  });

  await Promise.all([
    prisma.payment.create({
      data: {
        type: "MONTHLY_RENT",
        direction: "IN",
        amount: "25000.00",
        paidAt: new Date("2026-03-05T00:00:00.000Z"),
        method: "BANK_TRANSFER",
        assetId: ids.ownerAssetId,
        contractId: cOwner.id,
      },
    }),
    prisma.rentSchedule.create({
      data: {
        contractId: cOwner.id,
        periodStart: new Date("2026-04-01T00:00:00.000Z"),
        periodEnd: new Date("2026-04-30T00:00:00.000Z"),
        dueDate: new Date("2026-04-05T00:00:00.000Z"),
        amountDue: "25000.00",
        amountPaid: "10000.00",
        status: "PARTIAL",
      },
    }),
    prisma.expense.create({
      data: {
        assetId: ids.ownerAssetId,
        category: "REPAIR",
        amount: "2000.00",
        incurredAt: new Date("2026-03-10T00:00:00.000Z"),
      },
    }),
    prisma.commission.create({
      data: {
        contractId: cAgent.id,
        assetId: ids.agentRentAssetId,
        ownershipType: "AGENT",
        formula: "ONE_MONTH",
        baseAmount: "30000.00",
        totalAmount: "30000.00",
        status: "AWAITING_OWNER_PAYMENT",
        currentRevision: 1,
        splits: {
          create: [
            {
              revision: 1,
              role: "CLOSER",
              userId: ids.agSukId,
              shareType: "PERCENT",
              sharePercent: "80.00",
              amount: "24000.00",
              withholdingTax: "0.00",
              netAmount: "24000.00",
            },
            {
              revision: 1,
              role: "COMPANY",
              userId: null,
              shareType: "PERCENT",
              sharePercent: "20.00",
              amount: "6000.00",
              withholdingTax: "0.00",
              netAmount: "6000.00",
            },
          ],
        },
      },
    }),
    prisma.commission.create({
      data: {
        saleDealId: sDeal.id,
        assetId: ids.agentSaleAssetId,
        ownershipType: "AGENT",
        formula: "PERCENT_SALE_PRICE",
        baseAmount: "5000000.00",
        totalAmount: "150000.00",
        status: "RECEIVED",
        currentRevision: 1,
        splits: {
          create: [
            {
              revision: 1,
              role: "CLOSER",
              userId: ids.agSilId,
              shareType: "PERCENT",
              sharePercent: "70.00",
              amount: "105000.00",
              withholdingTax: "0.00",
              netAmount: "105000.00",
            },
            {
              revision: 1,
              role: "COMPANY",
              userId: null,
              shareType: "PERCENT",
              sharePercent: "30.00",
              amount: "45000.00",
              withholdingTax: "0.00",
              netAmount: "45000.00",
            },
          ],
        },
      },
    }),
  ]);
}
