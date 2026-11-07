"use client";

import { ASSET_CATEGORIES } from "@rrs/shared";
import { t, type MessageKey } from "@/i18n/th";

export interface LeadFormState {
  intent: "RENT" | "BUY";
  fullName: string;
  phone: string;
  lineId: string;
  email: string;
  nationality: string;
  source: string;
  ownerAgentId: string;
  budgetMin: string;
  budgetMax: string;
  preferredLocation: string;
  preferredProjectId: string;
  preferredCategory: string;
  preferredRoomType: string;
  minAreaSqm: string;
  occupants: string;
  moveInDate: string;
  leaseMonths: string;
  petRequired: boolean;
  specialNote: string;
}

const ROOM_TYPES = [
  { value: "", label: "-- ไม่ระบุ --" },
  { value: "STUDIO", label: "Studio" },
  { value: "ONE_BEDROOM", label: "1 ห้องนอน (1 Bedroom)" },
  { value: "TWO_BEDROOMS", label: "2 ห้องนอน (2 Bedrooms)" },
  { value: "THREE_BEDROOMS", label: "3 ห้องนอน (3 Bedrooms)" },
  { value: "PENTHOUSE", label: "Penthouse" },
  { value: "DUPLEX", label: "Duplex" },
  { value: "OTHER", label: "อื่นๆ" },
] as const;

export function LeadPreferencesFields(props: {
  form: LeadFormState;
  projects: Array<{ id: string; name: string }>;
  onChange: (patch: Partial<LeadFormState>) => void;
}) {
  const { form, projects, onChange } = props;
  const inputCls = "mt-1 w-full rounded border border-line bg-surface px-3 py-2 text-sm text-ink";

  return (
    <div className="space-y-3 rounded-lg border border-line bg-surface-subtle/60 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
        ส่วนที่ 2: ความต้องการเชิงลึก (ใช้จับคู่ทรัพย์อัตโนมัติ / Matching)
      </h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium text-ink">
          ประเภททรัพย์ที่สนใจ
          <select
            aria-label="ประเภททรัพย์ที่สนใจ"
            value={form.preferredCategory}
            onChange={(e) => onChange({ preferredCategory: e.target.value })}
            className={inputCls}
          >
            <option value="">-- ทุกประเภท --</option>
            {ASSET_CATEGORIES.map((c) => (
              <option key={c} value={c}>{t(`assets.cat.${c}` as MessageKey)}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-ink">
          โครงการที่สนใจ
          <select
            aria-label="โครงการที่สนใจ"
            value={form.preferredProjectId}
            onChange={(e) => onChange({ preferredProjectId: e.target.value })}
            className={inputCls}
          >
            <option value="">-- ไม่ระบุโครงการ --</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-ink">
          รูปแบบห้องที่ต้องการ
          <select
            aria-label="รูปแบบห้องที่ต้องการ"
            value={form.preferredRoomType}
            onChange={(e) => onChange({ preferredRoomType: e.target.value })}
            className={inputCls}
          >
            {ROOM_TYPES.map((rt) => (
              <option key={rt.value} value={rt.value}>{rt.label}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-ink">
          ทำเลที่ต้องการ
          <input
            type="text"
            aria-label="ทำเลที่ต้องการ"
            placeholder="เช่น อโศก, ทองหล่อ, ลาดพร้าว"
            value={form.preferredLocation}
            onChange={(e) => onChange({ preferredLocation: e.target.value })}
            className={inputCls}
          />
        </label>
        <label className="text-xs font-medium text-ink">
          งบประมาณต่ำสุด (บาท)
          <input
            type="number"
            aria-label="งบประมาณต่ำสุด"
            value={form.budgetMin}
            onChange={(e) => onChange({ budgetMin: e.target.value })}
            className={inputCls}
          />
        </label>
        <label className="text-xs font-medium text-ink">
          งบประมาณสูงสุด (บาท)
          <input
            type="number"
            aria-label="งบประมาณสูงสุด"
            value={form.budgetMax}
            onChange={(e) => onChange({ budgetMax: e.target.value })}
            className={inputCls}
          />
        </label>
        <label className="text-xs font-medium text-ink">
          พื้นที่ขั้นต่ำ (ตร.ม.)
          <input
            type="number"
            step="0.01"
            aria-label="พื้นที่ขั้นต่ำ"
            value={form.minAreaSqm}
            onChange={(e) => onChange({ minAreaSqm: e.target.value })}
            className={inputCls}
          />
        </label>
        <label className="text-xs font-medium text-ink">
          จำนวนผู้พักอาศัย (คน)
          <input
            type="number"
            aria-label="จำนวนผู้พักอาศัย"
            value={form.occupants}
            onChange={(e) => onChange({ occupants: e.target.value })}
            className={inputCls}
          />
        </label>
        <label className="text-xs font-medium text-ink">
          วันที่ต้องการเข้าอยู่
          <input
            type="date"
            aria-label="วันที่ต้องการเข้าอยู่"
            value={form.moveInDate}
            onChange={(e) => onChange({ moveInDate: e.target.value })}
            className={inputCls}
          />
        </label>
        <label className="text-xs font-medium text-ink">
          ระยะเวลาเช่า (เดือน)
          <input
            type="number"
            aria-label="ระยะเวลาเช่า"
            placeholder="เช่น 12"
            value={form.leaseMonths}
            onChange={(e) => onChange({ leaseMonths: e.target.value })}
            className={inputCls}
          />
        </label>
        <label className="flex items-center gap-2 pt-2 text-xs font-medium text-ink sm:col-span-2">
          <input
            type="checkbox"
            aria-label="ต้องการเลี้ยงสัตว์"
            checked={form.petRequired}
            onChange={(e) => onChange({ petRequired: e.target.checked })}
            className="h-4 w-4 rounded border-line"
          />
          <span>ลูกค้ามีสัตว์เลี้ยง (ต้องการห้อง Pet-Friendly)</span>
        </label>
        <label className="text-xs font-medium text-ink sm:col-span-2">
          หมายเหตุพิเศษ / เงื่อนไขเพิ่มเติม
          <textarea
            rows={2}
            aria-label="หมายเหตุพิเศษ"
            value={form.specialNote}
            onChange={(e) => onChange({ specialNote: e.target.value })}
            className={inputCls}
          />
        </label>
      </div>
    </div>
  );
}
