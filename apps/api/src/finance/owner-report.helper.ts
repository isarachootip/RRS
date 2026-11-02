import type { Prisma } from "@rrs/db";
import { fromSatang, toSatang } from "@rrs/shared";
import type { PrismaService } from "../prisma/prisma.service";
import type { OwnerNetIncomeQueryDto } from "./finance.types";

export interface MonthlyBucketSatang {
  contractRent: bigint;
  rentCollected: bigint;
  otherIncome: bigint;
  commissionPaid: bigint;
  expenses: bigint;
}

export interface FormattedMonthlyIncome {
  month: string;
  contractRent: string;
  contractRentSatang: string;
  rentCollected: string;
  rentCollectedSatang: string;
  otherIncome: string;
  otherIncomeSatang: string;
  commissionPaid: string;
  commissionPaidSatang: string;
  expenses: string;
  expensesSatang: string;
  netIncome: string;
  netIncomeSatang: string;
}

function emptyBucket(): MonthlyBucketSatang {
  return { contractRent: 0n, rentCollected: 0n, otherIncome: 0n, commissionPaid: 0n, expenses: 0n };
}

function addBuckets(a: MonthlyBucketSatang, b: MonthlyBucketSatang): MonthlyBucketSatang {
  return {
    contractRent: a.contractRent + b.contractRent,
    rentCollected: a.rentCollected + b.rentCollected,
    otherIncome: a.otherIncome + b.otherIncome,
    commissionPaid: a.commissionPaid + b.commissionPaid,
    expenses: a.expenses + b.expenses,
  };
}

function formatBucket(month: string, b: MonthlyBucketSatang): FormattedMonthlyIncome {
  const net = b.rentCollected + b.otherIncome - b.commissionPaid - b.expenses;
  return {
    month,
    contractRent: fromSatang(b.contractRent),
    contractRentSatang: b.contractRent.toString(),
    rentCollected: fromSatang(b.rentCollected),
    rentCollectedSatang: b.rentCollected.toString(),
    otherIncome: fromSatang(b.otherIncome),
    otherIncomeSatang: b.otherIncome.toString(),
    commissionPaid: fromSatang(b.commissionPaid),
    commissionPaidSatang: b.commissionPaid.toString(),
    expenses: fromSatang(b.expenses),
    expensesSatang: b.expenses.toString(),
    netIncome: fromSatang(net),
    netIncomeSatang: net.toString(),
  };
}

function toMonthKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export async function computeOwnerNetIncomeReport(
  prisma: PrismaService,
  assetScope: Prisma.AssetWhereInput,
  query: OwnerNetIncomeQueryDto,
) {
  const assets = await prisma.asset.findMany({
    where: {
      ...assetScope,
      ownershipType: "OWNER",
      ...(query.assetId ? { id: query.assetId } : {}),
    },
    select: { id: true, code: true, unitNo: true, category: true, rentPrice: true },
    orderBy: { code: "asc" },
  });

  const monthKeys = Array.from({ length: 12 }, (_, i) => `${query.year}-${String(i + 1).padStart(2, "0")}`);
  if (assets.length === 0) {
    return {
      year: query.year,
      months: monthKeys,
      rooms: [],
      grandTotals: formatBucket(`${query.year}-TOTAL`, emptyBucket()),
    };
  }

  const assetIds = assets.map((a) => a.id);
  const yearStart = new Date(Date.UTC(query.year, 0, 1, 0, 0, 0));
  const yearEnd = new Date(Date.UTC(query.year + 1, 0, 1, 0, 0, 0));

  const [schedules, payments, expenses] = await Promise.all([
    prisma.rentSchedule.findMany({
      where: {
        dueDate: { gte: yearStart, lt: yearEnd },
        contract: { assetId: { in: assetIds }, status: { not: "SUPERSEDED" } },
      },
      select: { dueDate: true, amountDue: true, contract: { select: { assetId: true } } },
    }),
    prisma.payment.findMany({
      where: {
        assetId: { in: assetIds },
        archivedAt: null,
        paidAt: { gte: yearStart, lt: yearEnd },
      },
      select: { assetId: true, type: true, direction: true, amount: true, paidAt: true },
    }),
    prisma.expense.findMany({
      where: {
        assetId: { in: assetIds },
        archivedAt: null,
        OR: [
          { paidAt: { gte: yearStart, lt: yearEnd } },
          { paidAt: null, incurredAt: { gte: yearStart, lt: yearEnd } },
        ],
      },
      select: { assetId: true, amount: true, incurredAt: true, paidAt: true },
    }),
  ]);

  const grid = new Map<string, Map<string, MonthlyBucketSatang>>();
  for (const a of assets) {
    const mMap = new Map<string, MonthlyBucketSatang>();
    for (const mk of monthKeys) mMap.set(mk, emptyBucket());
    grid.set(a.id, mMap);
  }

  for (const s of schedules) {
    const b = grid.get(s.contract.assetId)?.get(toMonthKey(s.dueDate));
    if (b) b.contractRent += toSatang(s.amountDue);
  }

  for (const p of payments) {
    if (!p.assetId) continue;
    const b = grid.get(p.assetId)?.get(toMonthKey(p.paidAt));
    if (!b) continue;
    const amt = toSatang(p.amount);
    if (p.direction === "IN") {
      if (p.type === "MONTHLY_RENT" || p.type === "ADVANCE_RENT") b.rentCollected += amt;
      else if (p.type === "OTHER_INCOME" || p.type === "BOOKING_FEE") b.otherIncome += amt;
    } else if (p.direction === "OUT" && p.type !== "REFUND") {
      b.commissionPaid += amt;
    }
  }

  for (const e of expenses) {
    const effDate = e.paidAt ?? e.incurredAt;
    const b = grid.get(e.assetId)?.get(toMonthKey(effDate));
    if (b) b.expenses += toSatang(e.amount);
  }

  let grandBucket = emptyBucket();
  const rooms = assets.map((asset) => {
    const mMap = grid.get(asset.id)!;
    let roomTotal = emptyBucket();
    const monthly = monthKeys.map((mk) => {
      const cell = mMap.get(mk)!;
      roomTotal = addBuckets(roomTotal, cell);
      return formatBucket(mk, cell);
    });
    grandBucket = addBuckets(grandBucket, roomTotal);
    return {
      assetId: asset.id,
      assetCode: asset.code,
      unitNo: asset.unitNo,
      category: asset.category,
      monthly,
      totals: formatBucket(`${query.year}-TOTAL`, roomTotal),
    };
  });

  return {
    year: query.year,
    months: monthKeys,
    rooms,
    grandTotals: formatBucket(`${query.year}-TOTAL`, grandBucket),
  };
}
