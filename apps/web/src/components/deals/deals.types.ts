export type ContractStatusCode = "DRAFT" | "PENDING_SIGNATURE" | "ACTIVE" | "ENDED" | "TERMINATED" | "SUPERSEDED";

export type SaleStageCode =
  | "INTERESTED"
  | "OFFERED"
  | "DEPOSIT_PAID"
  | "SPA_SIGNED"
  | "LOAN_PENDING"
  | "TRANSFERRED"
  | "CLOSED"
  | "CANCELLED";

export type FeePayerCode = "BUYER" | "SELLER" | "SPLIT";

export interface ContractItem {
  id: string;
  contractNo: string;
  revision: number;
  revisionOfId: string | null;
  previousContractId: string | null;
  bookingId: string | null;
  assetId: string;
  leadId: string;
  ownerId: string;
  monthlyRent: string | number;
  securityDeposit: string | number;
  advanceRent: string | number;
  startDate: string;
  endDate: string;
  status: ContractStatusCode;
  signedAt: string | null;
  terminatedAt: string | null;
  terminationReason: string | null;
  note: string | null;
  lead: { id: string; code: string; fullName: string; phone: string | null; status: string };
  asset: {
    id: string;
    code: string;
    category: string;
    unitNo: string | null;
    status: string;
    project: { id: string; name: string } | null;
  };
  owner: { id: string; code: string; fullName: string };
  booking: { id: string; code: string; status: string } | null;
  revisionOf: { id: string; contractNo: string; revision: number } | null;
  previousContract: { id: string; contractNo: string } | null;
  commission: { id: string; status: string; formula: string; baseAmount: string | number } | null;
}

export interface SaleDealItem {
  id: string;
  code: string;
  leadId: string;
  assetId: string;
  ownerId: string;
  agentId: string;
  stage: SaleStageCode;
  askingPrice: string | number | null;
  offeredPrice: string | number | null;
  agreedPrice: string | number | null;
  depositAmount: string | number | null;
  spaSignedAt: string | null;
  transferDate: string | null;
  transferFeePayer: FeePayerCode | null;
  loanBank: string | null;
  cancelReason: string | null;
  note: string | null;
  lead: { id: string; code: string; fullName: string; phone: string | null; status: string };
  asset: {
    id: string;
    code: string;
    category: string;
    unitNo: string | null;
    salePrice: string | number | null;
    status: string;
    project: { id: string; name: string } | null;
  };
  agent: { id: string; fullName: string; nickname: string | null };
  commission: { id: string; status: string; formula: string; baseAmount: string | number } | null;
}

export const CONTRACT_STATUS_LABELS: Record<ContractStatusCode, string> = {
  DRAFT: "ฉบับร่าง",
  PENDING_SIGNATURE: "รอลงนาม",
  ACTIVE: "มีผลบังคับใช้",
  ENDED: "สิ้นสุดสัญญา",
  TERMINATED: "ยกเลิกก่อนกำหนด",
  SUPERSEDED: "ถูกแทนที่ด้วย Revision ใหม่",
};

export const CONTRACT_STATUS_COLORS: Record<ContractStatusCode, string> = {
  DRAFT: "bg-slate-100 text-slate-700 border-slate-300",
  PENDING_SIGNATURE: "bg-amber-50 text-amber-800 border-amber-200",
  ACTIVE: "bg-emerald-50 text-emerald-800 border-emerald-200",
  ENDED: "bg-slate-100 text-slate-600 border-slate-200",
  TERMINATED: "bg-rose-50 text-rose-800 border-rose-200",
  SUPERSEDED: "bg-purple-50 text-purple-800 border-purple-200",
};

export const SALE_STAGE_LABELS: Record<SaleStageCode, string> = {
  INTERESTED: "สนใจ",
  OFFERED: "เสนอราคา",
  DEPOSIT_PAID: "วางมัดจำ",
  SPA_SIGNED: "สัญญาจะซื้อจะขาย",
  LOAN_PENDING: "รออนุมัติสินเชื่อ",
  TRANSFERRED: "โอนกรรมสิทธิ์",
  CLOSED: "ปิดการขาย",
  CANCELLED: "ยกเลิก",
};

export const SALE_STAGE_COLORS: Record<SaleStageCode, string> = {
  INTERESTED: "bg-slate-100 text-slate-700 border-slate-300",
  OFFERED: "bg-blue-50 text-blue-800 border-blue-200",
  DEPOSIT_PAID: "bg-amber-50 text-amber-800 border-amber-200",
  SPA_SIGNED: "bg-indigo-50 text-indigo-800 border-indigo-200",
  LOAN_PENDING: "bg-purple-50 text-purple-800 border-purple-200",
  TRANSFERRED: "bg-teal-50 text-teal-800 border-teal-200",
  CLOSED: "bg-emerald-50 text-emerald-800 border-emerald-200",
  CANCELLED: "bg-rose-50 text-rose-800 border-rose-200",
};

export const FEE_PAYER_LABELS: Record<FeePayerCode, string> = {
  BUYER: "ผู้ซื้อจ่าย",
  SELLER: "ผู้ขายจ่าย",
  SPLIT: "คนละครึ่ง (50/50)",
};
