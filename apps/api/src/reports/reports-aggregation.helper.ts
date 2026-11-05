import type { Prisma } from "@rrs/db";
import { fromSatang, toSatang } from "@rrs/shared";
import type {
  AggregatedReportBucket,
  NormalizedDealRow,
  ReportFilterQueryDto,
  ReportGranularity,
  SharedReportDataset,
} from "./reports.types";

export function extractCommissionSatang(
  com: {
    status: string;
    currentRevision: number;
    totalAmount: Prisma.Decimal;
    splits: Array<{
      revision: number;
      role: string;
      userId: string | null;
      amount: Prisma.Decimal;
      netAmount: Prisma.Decimal;
      payout: { status: string } | null;
    }>;
  } | null,
  ownershipType: "OWNER" | "AGENT",
  onlyUserId: string | null,
) {
  if (!com || com.status === "CANCELLED") {
    return {
      totalCommissionSatang: 0n,
      agentShareSatang: 0n,
      companyShareSatang: 0n,
      receivableSatang: 0n,
      payableSatang: 0n,
    };
  }
  const totalCommissionSatang = toSatang(com.totalAmount);
  const currentSplits = com.splits.filter((s) => s.revision === com.currentRevision);
  let agentShareSatang = 0n;
  let companyShareSatang = 0n;
  let payableSatang = 0n;

  for (const s of currentSplits) {
    if (s.role === "COMPANY") {
      if (!onlyUserId) companyShareSatang += toSatang(s.amount);
    } else if (!onlyUserId || s.userId === onlyUserId) {
      const net = toSatang(s.netAmount);
      agentShareSatang += net;
      if (
        ["APPROVED", "AWAITING_OWNER_PAYMENT", "RECEIVED", "AWAITING_PAYOUT"].includes(com.status) &&
        s.payout?.status !== "PAID"
      ) {
        payableSatang += net;
      }
    }
  }

  const receivableSatang =
    ownershipType === "AGENT" && ["APPROVED", "AWAITING_OWNER_PAYMENT"].includes(com.status)
      ? totalCommissionSatang
      : 0n;

  return { totalCommissionSatang, agentShareSatang, companyShareSatang, receivableSatang, payableSatang };
}

function sumDealRows(rows: NormalizedDealRow[]) {
  let ownerRev = 0n;
  let ownerExp = 0n;
  let ownerNet = 0n;
  let totalCom = 0n;
  let agentSh = 0n;
  let compCom = 0n;
  let compNet = 0n;
  let rec = 0n;
  let pay = 0n;

  for (const r of rows) {
    ownerRev += r.ownerRevenueSatang;
    ownerExp += r.ownerExpenseSatang + r.ownerCommissionPaidSatang;
    ownerNet += r.ownerNetIncomeSatang;
    totalCom += r.totalCommissionSatang;
    agentSh += r.agentShareSatang;
    compCom += r.companyCommissionShareSatang;
    compNet += r.companyNetIncomeSatang;
    rec += r.receivableSatang;
    pay += r.payableSatang;
  }

  return {
    dealsCount: rows.length,
    ownerRevenue: fromSatang(ownerRev),
    ownerExpense: fromSatang(ownerExp),
    ownerNetIncome: fromSatang(ownerNet),
    totalCommission: fromSatang(totalCom),
    agentShare: fromSatang(agentSh),
    companyCommissionShare: fromSatang(compCom),
    companyNetIncome: fromSatang(compNet),
    receivables: fromSatang(rec),
    payables: fromSatang(pay),
  };
}

function periodKey(d: Date, granularity: ReportGranularity): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  if (granularity === "YEAR") return `${y}`;
  if (granularity === "DAY") return `${y}-${m}-${day}`;
  return `${y}-${m}`;
}

export function buildDashboardFromDataset(dataset: SharedReportDataset) {
  const financials = sumDealRows(dataset.rows);
  return {
    totalAssets: dataset.totalAssets,
    assetsByStatus: dataset.assetsByStatus,
    funnel: dataset.funnel,
    financials,
    topKpis: [
      { code: "COMPANY_NET_INCOME", label: "รายได้สุทธิบริษัท", value: financials.companyNetIncome },
      { code: "TOTAL_COMMISSION", label: "ค่านายหน้ารวม", value: financials.totalCommission },
      { code: "OWNER_NET_INCOME", label: "รายได้สุทธิห้อง Owner", value: financials.ownerNetIncome },
      {
        code: "CLOSED_DEALS_FUNNEL",
        label: "ดีลปิด / อัตราปิด",
        value: `${dataset.funnel.closedDeals} (${dataset.funnel.conversionRatePercent}%)`,
      },
      {
        code: "RECEIVABLES_PAYABLES",
        label: "ค้างรับ / ค้างจ่าย",
        value: `${financials.receivables} / ${financials.payables}`,
      },
    ],
  };
}

export function buildReportSummaryFromDataset(dataset: SharedReportDataset, query: ReportFilterQueryDto) {
  const bucketsMap = new Map<string, { label: string; rows: NormalizedDealRow[] }>();

  for (const r of dataset.rows) {
    let key = "";
    let label = "";
    switch (query.groupBy) {
      case "OWNERSHIP":
        key = r.ownershipType;
        label = r.ownershipType === "OWNER" ? "ห้องของบริษัท (OWNER)" : "ห้องฝากดูแล (AGENT)";
        break;
      case "PROJECT":
        key = r.projectId ?? "NONE";
        label = r.projectName;
        break;
      case "AGENT":
        key = r.agentId ?? "NONE";
        label = r.agentName;
        break;
      case "CONTRACT_DEAL":
        key = r.id;
        label = `${r.dealCode} (${r.assetCode})`;
        break;
      default: {
        const pk = periodKey(r.date, query.granularity);
        key = pk;
        label = pk;
        break;
      }
    }
    const existing = bucketsMap.get(key) ?? { label, rows: [] };
    existing.rows.push(r);
    bucketsMap.set(key, existing);
  }

  const buckets: AggregatedReportBucket[] = Array.from(bucketsMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, b]) => ({
      key,
      label: b.label,
      ...sumDealRows(b.rows),
    }));

  return {
    groupBy: query.groupBy,
    granularity: query.granularity,
    buckets,
    totals: sumDealRows(dataset.rows),
  };
}
