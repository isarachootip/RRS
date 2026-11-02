export type BookingStatusCode = "PENDING_PAYMENT" | "PAID" | "CONVERTED" | "CANCELLED";

export type PaymentMethodCode = "CASH" | "BANK_TRANSFER" | "PROMPTPAY" | "CHEQUE" | "CARD" | "OTHER";

export interface BookingItem {
  id: string;
  code: string;
  leadId: string;
  assetId: string;
  monthlyRent: string | number;
  bookingFee: string | number;
  securityDeposit: string | number;
  advanceRent: string | number;
  startDate: string;
  endDate: string;
  status: BookingStatusCode;
  paidAt: string | null;
  receivedById: string | null;
  cancelReason: string | null;
  feeForfeited: boolean | null;
  note: string | null;
  createdAt: string;
  lead: {
    id: string;
    code: string;
    fullName: string;
    phone: string | null;
    status: string;
  };
  asset: {
    id: string;
    code: string;
    category: string;
    unitNo: string | null;
    rentPrice: string | number | null;
    status: string;
    project: { id: string; name: string } | null;
  };
  receivedBy: {
    id: string;
    fullName: string;
    nickname: string | null;
  } | null;
  payments: Array<{
    id: string;
    type: string;
    direction: string;
    amount: string | number;
    paidAt: string;
    method: PaymentMethodCode;
    reference: string | null;
    proofFileId: string | null;
  }>;
}

export const BOOKING_STATUS_LABELS: Record<BookingStatusCode, string> = {
  PENDING_PAYMENT: "รอชำระเงินจอง",
  PAID: "ชำระแล้ว (ล็อกห้อง)",
  CONVERTED: "แปลงเป็นสัญญาแล้ว",
  CANCELLED: "ยกเลิก",
};

export const BOOKING_STATUS_COLORS: Record<BookingStatusCode, string> = {
  PENDING_PAYMENT: "bg-amber-50 text-amber-800 border-amber-200",
  PAID: "bg-emerald-50 text-emerald-800 border-emerald-200",
  CONVERTED: "bg-blue-50 text-blue-800 border-blue-200",
  CANCELLED: "bg-slate-100 text-slate-600 border-slate-200",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodCode, string> = {
  BANK_TRANSFER: "โอนเงินบัญชีธนาคาร",
  PROMPTPAY: "พร้อมเพย์ (PromptPay)",
  CASH: "เงินสด",
  CARD: "บัตรเครดิต/เดบิต",
  CHEQUE: "เช็คธนาคาร",
  OTHER: "อื่นๆ",
};

export function formatThaiDate(iso: string): string {
  return new Date(iso).toLocaleDateString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatMoney(val: string | number | null | undefined): string {
  const num = Number(val ?? 0);
  return num.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export const BOOKING_FORM_FIELDS: Array<{
  key: "monthlyRent" | "bookingFee" | "securityDeposit" | "advanceRent" | "startDate" | "endDate";
  label: string;
  aria: string;
  type: "number" | "date";
  min?: string;
  req: boolean;
}> = [
  { key: "monthlyRent", label: "ค่าเช่า/เดือน (บาท) *", aria: "ค่าเช่าต่อเดือน", type: "number", min: "1", req: true },
  { key: "bookingFee", label: "เงินจอง (บาท)", aria: "เงินจอง", type: "number", min: "0", req: false },
  { key: "securityDeposit", label: "เงินประกัน (บาท)", aria: "เงินประกัน", type: "number", min: "0", req: false },
  { key: "advanceRent", label: "ค่าเช่าล่วงหน้า (บาท)", aria: "ค่าเช่าล่วงหน้า", type: "number", min: "0", req: false },
  { key: "startDate", label: "วันที่เริ่มสัญญา *", aria: "วันที่เริ่มสัญญา", type: "date", req: true },
  { key: "endDate", label: "วันที่สิ้นสุดสัญญา *", aria: "วันที่สิ้นสุดสัญญา", type: "date", req: true },
];
