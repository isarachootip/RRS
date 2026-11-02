export type PaymentType =
  | "BOOKING_FEE"
  | "SECURITY_DEPOSIT"
  | "ADVANCE_RENT"
  | "MONTHLY_RENT"
  | "SALE_DEPOSIT"
  | "SALE_PAYMENT"
  | "COMMISSION_FROM_OWNER"
  | "OTHER_INCOME"
  | "REFUND";

export type PaymentDirection = "IN" | "OUT";
export type PaymentMethod = "CASH" | "BANK_TRANSFER" | "PROMPTPAY" | "CHEQUE" | "CARD" | "OTHER";
export type RentScheduleStatus = "DUE" | "PARTIAL" | "PAID" | "OVERDUE" | "WAIVED";
export type ExpenseCategory =
  | "COMMON_FEE"
  | "REPAIR"
  | "UTILITY"
  | "PROPERTY_TAX"
  | "INSURANCE"
  | "CLEANING"
  | "MARKETING"
  | "OTHER";

export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  BOOKING_FEE: "เงินจอง",
  SECURITY_DEPOSIT: "เงินประกัน",
  ADVANCE_RENT: "ค่าเช่าล่วงหน้า",
  MONTHLY_RENT: "ค่าเช่ารายเดือน",
  SALE_DEPOSIT: "เงินมัดจำซื้อ",
  SALE_PAYMENT: "ชำระค่าซื้อขาย",
  COMMISSION_FROM_OWNER: "ค่านายหน้า",
  OTHER_INCOME: "รายรับอื่น",
  REFUND: "คืนเงิน",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  BANK_TRANSFER: "โอนผ่านธนาคาร",
  PROMPTPAY: "พร้อมเพย์ (PromptPay)",
  CASH: "เงินสด",
  CHEQUE: "เช็ค",
  CARD: "บัตรเครดิต/เดบิต",
  OTHER: "อื่น ๆ",
};

export const SCHEDULE_STATUS_LABELS: Record<RentScheduleStatus, string> = {
  DUE: "รอชำระ",
  PARTIAL: "ชำระบางส่วน",
  PAID: "ชำระแล้ว",
  OVERDUE: "ค้างชำระเกินกำหนด",
  WAIVED: "ยกเว้น",
};

export const SCHEDULE_STATUS_COLORS: Record<RentScheduleStatus, string> = {
  DUE: "bg-amber-100 text-amber-800",
  PARTIAL: "bg-blue-100 text-blue-800",
  PAID: "bg-emerald-100 text-emerald-800",
  OVERDUE: "bg-red-100 text-red-700",
  WAIVED: "bg-slate-100 text-slate-600",
};

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  COMMON_FEE: "ค่าส่วนกลาง",
  REPAIR: "ค่าซ่อมแซม",
  UTILITY: "ค่าน้ำ/ค่าไฟ/สาธารณูปโภค",
  PROPERTY_TAX: "ภาษีที่ดินและสิ่งปลูกสร้าง",
  INSURANCE: "ค่าประกันภัย",
  CLEANING: "ค่าทำความสะอาด",
  MARKETING: "ค่าการตลาด/โฆษณา",
  OTHER: "ค่าใช้จ่ายอื่น ๆ",
};

export interface MonthlyNetIncomeCell {
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

export interface RoomNetIncomeReport {
  assetId: string;
  assetCode: string;
  unitNo: string | null;
  category: string;
  monthly: MonthlyNetIncomeCell[];
  totals: MonthlyNetIncomeCell;
}

export interface OwnerNetIncomeReportResponse {
  year: number;
  months: string[];
  rooms: RoomNetIncomeReport[];
  grandTotals: MonthlyNetIncomeCell;
}

export interface RentScheduleRecord {
  id: string;
  contractId: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  amountDue: string;
  amountPaid: string;
  status: RentScheduleStatus;
  contract: {
    id: string;
    contractNo: string;
    asset: { id: string; code: string; unitNo: string | null };
    lead: { id: string; code: string; fullName: string };
  };
}

export interface ExpenseRecord {
  id: string;
  assetId: string;
  category: ExpenseCategory;
  amount: string;
  incurredAt: string;
  paidAt: string | null;
  vendor: string | null;
  note: string | null;
  asset: { id: string; code: string; unitNo: string | null };
}
