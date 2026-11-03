import type { CommissionFormula, DealRole, ShareType } from "@rrs/commission";

export type CommissionStatus =
  | "PENDING_CALC"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "AWAITING_OWNER_PAYMENT"
  | "RECEIVED"
  | "AWAITING_PAYOUT"
  | "PAID"
  | "CANCELLED";

export interface AgentBasic {
  id: string;
  fullName: string;
  isFreelance?: boolean;
}

export interface CommissionSplitItem {
  id: string;
  commissionId: string;
  revision: number;
  role: DealRole;
  userId: string | null;
  shareType: ShareType;
  sharePercent: string | null;
  amount: string;
  withholdingTax: string;
  netAmount: string;
  payoutId: string | null;
  user?: AgentBasic | null;
  payout?: {
    id: string;
    periodLabel: string;
    status: "PENDING" | "APPROVED" | "PAID";
    paidAt: string | null;
  } | null;
}

export interface CommissionRevisionItem {
  id: string;
  revision: number;
  reason: string | null;
  createdAt: string;
  approvedAt: string | null;
  approvedBy?: { id: string; fullName: string } | null;
  snapshot: {
    formula: CommissionFormula;
    baseAmount: string;
    termMonths?: number | null;
    totalAmount: string;
    splits: Array<{
      role: DealRole;
      userId: string | null;
      shareType: ShareType;
      sharePercent: string | null;
      amount: string;
      withholdingTax: string;
      netAmount: string;
    }>;
  };
}

export interface SuggestedSplitItem {
  role: DealRole;
  userId: string | null;
  shareType: ShareType;
  sharePercent: string;
}

export interface CommissionRecord {
  id: string;
  contractId: string | null;
  saleDealId: string | null;
  assetId: string;
  ownershipType: "OWNER" | "AGENT";
  formula: CommissionFormula;
  params: {
    percent?: string | number | null;
    capMonths?: number | null;
    months?: string | number | null;
    amount?: string | number | null;
    note?: string | null;
  };
  baseAmount: string;
  termMonths: number | null;
  totalAmount: string;
  status: CommissionStatus;
  currentRevision: number;
  approvedAt: string | null;
  ownerPaymentDueAt: string | null;
  receivedAt: string | null;
  asset: {
    id: string;
    code: string;
    unitNo: string | null;
    ownershipType: "OWNER" | "AGENT";
    primaryAgent?: AgentBasic | null;
    agents: Array<{ userId: string; role: string; user: AgentBasic }>;
  };
  contract?: {
    id: string;
    contractNo: string;
    monthlyRent: string;
    lead: { id: string; code: string; fullName: string; ownerAgent?: AgentBasic | null };
  } | null;
  saleDeal?: {
    id: string;
    code: string;
    agreedPrice: string | null;
    agent?: AgentBasic | null;
    lead: { id: string; code: string; fullName: string; ownerAgent?: AgentBasic | null };
  } | null;
  splits: CommissionSplitItem[];
  currentSplits: CommissionSplitItem[];
  suggestedSplits: SuggestedSplitItem[];
  revisions: CommissionRevisionItem[];
}

export interface CommissionPayoutRecord {
  id: string;
  userId: string;
  periodLabel: string;
  totalAmount: string;
  status: "PENDING" | "APPROVED" | "PAID";
  paidAt: string | null;
  method: string | null;
  user: AgentBasic;
  splits: Array<{
    id: string;
    role: DealRole;
    netAmount: string;
    commission: {
      id: string;
      asset: { code: string; unitNo: string | null };
      contract?: { contractNo: string } | null;
      saleDeal?: { code: string } | null;
    };
  }>;
}

export const FORMULA_LABELS: Record<CommissionFormula, string> = {
  ONE_MONTH: "ค่าเช่า 1 เดือน",
  PERCENT_TOTAL: "% ของค่าเช่ารวม",
  N_MONTHS: "ตามจำนวนเดือนที่ตกลง",
  FIXED: "จำนวนเงินคงที่",
  CUSTOM: "กำหนดเอง (ระบุหมายเหตุ)",
  PERCENT_SALE_PRICE: "% ของราคาขาย",
};

export const STATUS_LABELS: Record<CommissionStatus, string> = {
  PENDING_CALC: "รอคำนวณ",
  PENDING_REVIEW: "รอตรวจสอบ",
  APPROVED: "อนุมัติแล้ว",
  AWAITING_OWNER_PAYMENT: "รอรับเงินเจ้าของห้อง",
  RECEIVED: "ได้รับเงินแล้ว",
  AWAITING_PAYOUT: "รอจ่าย Agent",
  PAID: "จ่ายแล้ว",
  CANCELLED: "ยกเลิก",
};

export const ROLE_LABELS: Record<DealRole, string> = {
  FINDER: "ผู้หาลูกค้า",
  LISTING: "ผู้ดูแลห้อง",
  SHOWING: "ผู้พาดูห้อง",
  CLOSER: "ผู้ปิดดีล",
  COMPANY: "บริษัท",
};

export function collectCommissionAgents(commission: CommissionRecord): AgentBasic[] {
  const map = new Map<string, AgentBasic>();
  [
    commission.asset.primaryAgent,
    ...commission.asset.agents.map((ag) => ag.user),
    commission.contract?.lead.ownerAgent,
    commission.saleDeal?.agent,
    commission.saleDeal?.lead.ownerAgent,
    ...commission.splits.map((s) => s.user),
  ].forEach((a) => {
    if (a?.id) map.set(a.id, a);
  });
  return Array.from(map.values());
}

export function buildFormulaParams(formula: CommissionFormula, paramValue: string, customNote: string) {
  if (formula === "PERCENT_TOTAL" || formula === "PERCENT_SALE_PRICE") return { percent: paramValue };
  if (formula === "N_MONTHS") return { months: paramValue };
  if (formula === "FIXED") return { amount: paramValue };
  if (formula === "CUSTOM") return { amount: paramValue, note: customNote };
  return {};
}
