export type AppointmentStatusCode = "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW" | "RESCHEDULED";

export type FollowUpOutcomeCode =
  | "LIKED"
  | "NEGOTIATING_PRICE"
  | "WANTS_OTHER_UNITS"
  | "CONSIDERING"
  | "NOT_INTERESTED"
  | "AGREED";

export const FOLLOW_UP_OUTCOME_LABELS: Record<FollowUpOutcomeCode, string> = {
  LIKED: "ชอบ",
  NEGOTIATING_PRICE: "ต่อรองราคา",
  WANTS_OTHER_UNITS: "ขอดูห้องอื่น",
  CONSIDERING: "รอพิจารณา",
  NOT_INTERESTED: "ไม่สนใจ",
  AGREED: "ตกลงจอง/เช่า",
};

export type CalendarViewMode = "day" | "week" | "month";

export interface CalendarAppointmentItem {
  id: string;
  code: string | null;
  title: string;
  isBusyOnly: boolean;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatusCode;
  agentId: string;
  agent: {
    id: string;
    fullName: string;
    nickname: string | null;
    teamId: string | null;
  };
  leadId: string | null;
  lead: {
    id: string;
    code: string;
    fullName: string;
    phone: string | null;
    ownerAgentId: string;
    status: string;
  } | null;
  location: string | null;
  note: string | null;
  coordinatorId: string | null;
  coordinatorName: string | null;
  coordinatorPhone: string | null;
  rescheduledFromId: string | null;
  rescheduledFrom?: {
    id: string;
    code: string;
    startsAt: string;
    endsAt: string;
  } | null;
  items: Array<{
    appointmentId: string;
    assetId: string;
    sortOrder: number;
    outcome: string | null;
    outcomeNote: string | null;
    asset: {
      id: string;
      code: string;
      category: string;
      unitNo: string | null;
      status: string;
      project: { id: string; name: string } | null;
    };
  }>;
}

export interface OverlapItem {
  id: string;
  code: string;
  startsAt: string;
  endsAt: string;
  location: string | null;
  status: string;
}

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatusCode, string> = {
  PENDING: "รอยืนยัน",
  CONFIRMED: "ยืนยันแล้ว",
  COMPLETED: "นัดสำเร็จ",
  CANCELLED: "ยกเลิก",
  NO_SHOW: "ลูกค้าไม่มาตามนัด",
  RESCHEDULED: "เลื่อนนัด",
};

export const APPOINTMENT_STATUS_COLORS: Record<AppointmentStatusCode, string> = {
  PENDING: "bg-amber-50 text-amber-800 border-amber-200",
  CONFIRMED: "bg-blue-50 text-blue-800 border-blue-200",
  COMPLETED: "bg-emerald-50 text-emerald-800 border-emerald-200",
  CANCELLED: "bg-slate-100 text-slate-600 border-slate-200",
  NO_SHOW: "bg-rose-50 text-rose-800 border-rose-200",
  RESCHEDULED: "bg-purple-50 text-purple-800 border-purple-200",
};

export function getViewDateRange(anchor: Date, mode: CalendarViewMode): { from: Date; to: Date; days: Date[] } {
  const base = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  if (mode === "day") {
    const from = new Date(base);
    const to = new Date(base);
    to.setHours(23, 59, 59, 999);
    return { from, to, days: [from] };
  }
  if (mode === "week") {
    const dayOfWeek = base.getDay();
    const diffToMon = (dayOfWeek + 6) % 7;
    const from = new Date(base);
    from.setDate(base.getDate() - diffToMon);
    const days = Array.from({ length: 7 }, (_, idx) => {
      const d = new Date(from);
      d.setDate(from.getDate() + idx);
      return d;
    });
    const to = new Date(days[6]!);
    to.setHours(23, 59, 59, 999);
    return { from, to, days };
  }
  const firstOfMonth = new Date(base.getFullYear(), base.getMonth(), 1);
  const lastOfMonth = new Date(base.getFullYear(), base.getMonth() + 1, 0);
  const days: Date[] = [];
  for (let d = new Date(firstOfMonth); d <= lastOfMonth; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d));
  }
  const to = new Date(lastOfMonth);
  to.setHours(23, 59, 59, 999);
  return { from: firstOfMonth, to, days };
}

export function isSameLocalDate(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function formatTimeShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

export const APPOINTMENT_TEXT_FIELDS: Array<{
  key: "startsAt" | "endsAt" | "location" | "coordinatorName" | "coordinatorPhone";
  label: string;
  aria?: string;
  type?: string;
}> = [
  { key: "startsAt", label: "วันและเวลาเริ่ม *", aria: "วันและเวลาเริ่ม", type: "datetime-local" },
  { key: "endsAt", label: "วันและเวลาสิ้นสุด *", aria: "วันและเวลาสิ้นสุด", type: "datetime-local" },
  { key: "location", label: "สถานที่นัดพบ", aria: "สถานที่นัดพบ" },
  { key: "coordinatorName", label: "ผู้ประสานงาน / เจ้าของห้อง" },
  { key: "coordinatorPhone", label: "เบอร์โทรผู้ประสานงาน" },
];
