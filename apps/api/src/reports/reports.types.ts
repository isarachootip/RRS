import { AssetCategory, AssetStatus } from "@rrs/db";
import { z } from "zod";

export const ALL_ASSET_STATUSES: AssetStatus[] = [
  AssetStatus.AVAILABLE,
  AssetStatus.VIEWING_SCHEDULED,
  AssetStatus.NEGOTIATING,
  AssetStatus.BOOKED,
  AssetStatus.CONTRACTED,
  AssetStatus.SOLD,
  AssetStatus.UNAVAILABLE,
];

export function parseReportDateBounds(startDate?: string, endDate?: string) {
  const gte = startDate ? new Date(`${startDate}T00:00:00.000Z`) : undefined;
  const lte = endDate ? new Date(`${endDate}T23:59:59.999Z`) : undefined;
  return gte || lte ? { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) } : undefined;
}

export const AssetCategoryEnum = z.nativeEnum(AssetCategory);

export const ReportGranularityEnum = z.enum(["DAY", "MONTH", "YEAR"]);
export type ReportGranularity = z.infer<typeof ReportGranularityEnum>;

export const ReportGroupByEnum = z.enum(["PERIOD", "OWNERSHIP", "PROJECT", "AGENT", "CONTRACT_DEAL"]);
export type ReportGroupBy = z.infer<typeof ReportGroupByEnum>;

export const DealTypeFilterEnum = z.enum(["ALL", "RENT", "SALE"]);
export type DealTypeFilter = z.infer<typeof DealTypeFilterEnum>;

export const ExportFormatEnum = z.enum(["csv", "xlsx"]);
export type ExportFormat = z.infer<typeof ExportFormatEnum>;

export const ReportFilterQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  granularity: ReportGranularityEnum.default("MONTH"),
  groupBy: ReportGroupByEnum.default("PERIOD"),
  teamId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  category: AssetCategoryEnum.optional(),
  dealType: DealTypeFilterEnum.default("ALL"),
  ownerId: z.string().uuid().optional(),
  agentId: z.string().uuid().optional(),
  format: ExportFormatEnum.default("csv"),
});

export type ReportFilterQueryDto = z.infer<typeof ReportFilterQuerySchema>;

export interface NormalizedDealRow {
  id: string;
  dealCode: string;
  dealType: "RENT" | "SALE";
  date: Date;
  assetId: string;
  assetCode: string;
  ownershipType: "OWNER" | "AGENT";
  projectId: string | null;
  projectName: string;
  agentId: string | null;
  agentName: string;
  teamId: string | null;
  ownerRevenueSatang: bigint;
  ownerExpenseSatang: bigint;
  ownerCommissionPaidSatang: bigint;
  ownerNetIncomeSatang: bigint;
  totalCommissionSatang: bigint;
  agentShareSatang: bigint;
  companyCommissionShareSatang: bigint;
  companyNetIncomeSatang: bigint;
  receivableSatang: bigint;
  payableSatang: bigint;
}

export interface SharedReportDataset {
  assetsByStatus: Record<string, number>;
  totalAssets: number;
  funnel: {
    newLeads: number;
    viewings: number;
    bookingsAndOffers: number;
    closedDeals: number;
    conversionRatePercent: string;
  };
  rows: NormalizedDealRow[];
}

export interface AggregatedReportBucket {
  key: string;
  label: string;
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
