export type ReportGranularity = "DAY" | "MONTH" | "YEAR";
export type ReportGroupBy = "PERIOD" | "OWNERSHIP" | "PROJECT" | "AGENT" | "CONTRACT_DEAL";
export type DealTypeFilter = "ALL" | "RENT" | "SALE";

export interface ReportFilterState {
  startDate: string;
  endDate: string;
  teamId: string;
  projectId: string;
  category: string;
  dealType: DealTypeFilter;
  granularity: ReportGranularity;
  groupBy: ReportGroupBy;
}

export interface DashboardFinancials {
  dealsCount: number;
  ownerRevenue: string;
  ownerExpense: string;
  ownerNetIncome: string;
  totalCommission: string;
  agentShare: string;
  companyCommissionShare: string;
  companyNetIncome: string;
  receivables: string;
  payables: string;
}

export interface DashboardResponse {
  totalAssets: number;
  assetsByStatus: Record<string, number>;
  funnel: {
    newLeads: number;
    viewings: number;
    bookingsAndOffers: number;
    closedDeals: number;
    conversionRatePercent: string;
  };
  financials: DashboardFinancials;
  topKpis: Array<{
    code: string;
    label: string;
    value: string;
  }>;
}

export interface ReportBucketItem extends DashboardFinancials {
  key: string;
  label: string;
}

export interface ReportSummaryResponse {
  groupBy: ReportGroupBy;
  granularity: ReportGranularity;
  buckets: ReportBucketItem[];
  totals: DashboardFinancials;
}

export interface FilterOptionsResponse {
  teams: Array<{ id: string; name: string }>;
  projects: Array<{ id: string; name: string }>;
}

export const ASSET_STATUS_CHART_CONFIG: Array<{
  status: string;
  label: string;
  colorVar: string;
}> = [
  { status: "AVAILABLE", label: "ว่างพร้อมเช่า/ขาย", colorVar: "var(--color-status-available)" },
  { status: "VIEWING_SCHEDULED", label: "มีนัดดูห้อง", colorVar: "var(--color-status-booked)" },
  { status: "NEGOTIATING", label: "อยู่ระหว่างเจรจา", colorVar: "var(--color-status-booked)" },
  { status: "BOOKED", label: "จองแล้ว", colorVar: "var(--color-status-booked)" },
  { status: "CONTRACTED", label: "ทำสัญญาแล้ว", colorVar: "var(--color-status-contracted)" },
  { status: "SOLD", label: "ขายแล้ว", colorVar: "var(--color-status-contracted)" },
  { status: "UNAVAILABLE", label: "ไม่ว่าง/ปิดชั่วคราว", colorVar: "var(--color-status-unavailable)" },
];

export const ASSET_CATEGORY_LABELS: Record<string, string> = {
  CONDO: "คอนโดมิเนียม",
  HOUSE: "บ้านเดี่ยว",
  TOWNHOUSE: "ทาวน์โฮม",
  APARTMENT_UNIT: "ห้องอพาร์ตเมนต์",
  APARTMENT_BUILDING: "อาคารอพาร์ตเมนต์",
  FACTORY: "โรงงาน",
  WAREHOUSE: "โกดัง",
  LAND: "ที่ดิน",
  COMMERCIAL: "อาคารพาณิชย์",
};

export function buildReportQueryString(filters: Partial<ReportFilterState>): string {
  const sp = new URLSearchParams();
  if (filters.startDate) sp.set("startDate", filters.startDate);
  if (filters.endDate) sp.set("endDate", filters.endDate);
  if (filters.teamId) sp.set("teamId", filters.teamId);
  if (filters.projectId) sp.set("projectId", filters.projectId);
  if (filters.category) sp.set("category", filters.category);
  if (filters.dealType && filters.dealType !== "ALL") sp.set("dealType", filters.dealType);
  if (filters.granularity) sp.set("granularity", filters.granularity);
  if (filters.groupBy) sp.set("groupBy", filters.groupBy);
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}
