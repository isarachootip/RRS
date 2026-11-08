"use client";

import type { AssetCategory } from "@rrs/shared";
import type { AssetLocationState } from "./asset-location-media-fields";

export type RoomTypeOption =
  | "STUDIO"
  | "ONE_BEDROOM"
  | "TWO_BEDROOMS"
  | "THREE_BEDROOMS"
  | "PENTHOUSE"
  | "DUPLEX"
  | "OTHER";

export interface AssetUnitSpecState {
  roomType: RoomTypeOption | "";
  bedrooms: string;
  bathrooms: string;
  furniture: string;
  petAllowed: boolean;
}

export interface EditableAsset {
  id?: string;
  code?: string;
  category?: AssetCategory | string;
  ownershipType?: "OWNER" | "AGENT";
  ownerId?: string | null;
  projectId?: string | null;
  unitNo?: string | null;
  tower?: string | null;
  floor?: number | null;
  address?: string | null;
  district?: string | null;
  province?: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
  areaSqm?: string | number | null;
  roomType?: RoomTypeOption | string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  furniture?: string | null;
  petAllowed?: boolean | null;
  rentPrice?: string | number | null;
  minRentPrice?: string | number | null;
  salePrice?: string | number | null;
  attributes?: Record<string, unknown> | null;
}

const ROOM_CATEGORIES = new Set<AssetCategory>(["CONDO", "APARTMENT_UNIT"]);
const BED_BATH_CATEGORIES = new Set<AssetCategory>(["CONDO", "HOUSE", "TOWNHOME", "APARTMENT_UNIT", "COMMERCIAL"]);

export function isVerticalUnitCategory(category: AssetCategory): boolean {
  return category === "CONDO" || category === "APARTMENT_UNIT";
}

export function hasUsableAreaField(category: AssetCategory): boolean {
  return category !== "LAND";
}

export function unitNoLabelForCategory(category: AssetCategory): { label: string; placeholder: string } {
  switch (category) {
    case "CONDO":
    case "APARTMENT_UNIT":
      return { label: "เลขห้อง / ยูนิต", placeholder: "เช่น 2716 หรือ A-1205" };
    case "HOUSE":
    case "TOWNHOME":
      return { label: "บ้านเลขที่ / แปลง", placeholder: "เช่น 99/12 ซอย 4" };
    case "COMMERCIAL":
      return { label: "เลขที่อาคาร / ห้องแถว", placeholder: "เช่น 123/4-5" };
    case "LAND":
      return { label: "เลขที่โฉนด / ระวางอ้างอิง (ข้อมูลภายใน)", placeholder: "เช่น โฉนดเลขที่ 12345" };
    default:
      return { label: "เลขที่อาคาร / รหัสแปลง", placeholder: "เช่น 88/1 หมู่ 5" };
  }
}

export function defaultUnitSpecsForCategory(category: AssetCategory): AssetUnitSpecState {
  switch (category) {
    case "CONDO":
      return { roomType: "ONE_BEDROOM", bedrooms: "1", bathrooms: "1", furniture: "ครบชุด (Fully Furnished)", petAllowed: false };
    case "HOUSE":
    case "TOWNHOME":
      return { roomType: "", bedrooms: "3", bathrooms: "2", furniture: "บางส่วน (Partially Furnished)", petAllowed: true };
    case "COMMERCIAL":
      return { roomType: "", bedrooms: "2", bathrooms: "2", furniture: "ห้องเปล่า (Unfurnished)", petAllowed: false };
    case "APARTMENT_UNIT":
      return { roomType: "STUDIO", bedrooms: "1", bathrooms: "1", furniture: "ครบชุด (Fully Furnished)", petAllowed: false };
    default:
      return { roomType: "", bedrooms: "", bathrooms: "", furniture: "", petAllowed: false };
  }
}

export function initLoc(initial?: EditableAsset | null): AssetLocationState {
  return {
    projectId: initial?.projectId ?? "",
    tower: initial?.tower ?? "",
    floor: initial?.floor != null ? String(initial.floor) : "",
    address: initial?.address ?? "",
    district: initial?.district ?? "",
    province: initial?.province ?? "",
    latitude: initial?.latitude != null ? String(initial.latitude) : "",
    longitude: initial?.longitude != null ? String(initial.longitude) : "",
  };
}

export function initSpec(initial: EditableAsset | null | undefined, cat: AssetCategory): AssetUnitSpecState {
  const def = defaultUnitSpecsForCategory(cat);
  if (!initial?.id) return def;
  return {
    roomType: (initial.roomType as RoomTypeOption) ?? "",
    bedrooms: initial.bedrooms != null ? String(initial.bedrooms) : "",
    bathrooms: initial.bathrooms != null ? String(initial.bathrooms) : "",
    furniture: initial.furniture ?? "",
    petAllowed: Boolean(initial.petAllowed),
  };
}

export function AssetUnitSpecFields({
  category,
  spec,
  onChange,
}: {
  category: AssetCategory;
  spec: AssetUnitSpecState;
  onChange: (patch: Partial<AssetUnitSpecState>) => void;
}) {
  if (!BED_BATH_CATEGORIES.has(category)) return null;
  const inputCls = "w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink";

  return (
    <div className="space-y-3 rounded-lg border border-line bg-surface-subtle p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
        สเปกห้องและฟังก์ชันการใช้งาน (Unit & Living Specs)
      </h3>
      <div className="grid gap-3 sm:grid-cols-4">
        {ROOM_CATEGORIES.has(category) && (
          <label className="space-y-1 text-xs font-medium text-ink">
            <span>รูปแบบห้อง (Room Type)</span>
            <select aria-label="รูปแบบห้อง" value={spec.roomType} onChange={(e) => onChange({ roomType: e.target.value as RoomTypeOption | "" })} className={inputCls}>
              <option value="">-- ไม่ระบุ --</option>
              <option value="STUDIO">สตูดิโอ (Studio)</option>
              <option value="ONE_BEDROOM">1 ห้องนอน (1 Bedroom)</option>
              <option value="TWO_BEDROOMS">2 ห้องนอน (2 Bedrooms)</option>
              <option value="THREE_BEDROOMS">3 ห้องนอน (3 Bedrooms)</option>
              <option value="DUPLEX">ดูเพล็กซ์ 2 ชั้น (Duplex)</option>
              <option value="PENTHOUSE">เพนต์เฮาส์ (Penthouse)</option>
              <option value="OTHER">อื่นๆ</option>
            </select>
          </label>
        )}
        <label className="space-y-1 text-xs font-medium text-ink">
          <span>ห้องนอน / ห้องกั้น</span>
          <input type="number" min={0} aria-label="จำนวนห้องนอน" value={spec.bedrooms} onChange={(e) => onChange({ bedrooms: e.target.value })} placeholder="เช่น 2" className={inputCls} />
        </label>
        <label className="space-y-1 text-xs font-medium text-ink">
          <span>ห้องน้ำ</span>
          <input type="number" min={0} aria-label="จำนวนห้องน้ำ" value={spec.bathrooms} onChange={(e) => onChange({ bathrooms: e.target.value })} placeholder="เช่น 2" className={inputCls} />
        </label>
        <label className="space-y-1 text-xs font-medium text-ink">
          <span>เฟอร์นิเจอร์ / การตกแต่ง</span>
          <input aria-label="เฟอร์นิเจอร์" value={spec.furniture} onChange={(e) => onChange({ furniture: e.target.value })} placeholder="เช่น แต่งครบ / ห้องเปล่า" className={inputCls} />
        </label>
        <label className="flex items-center gap-2 pt-2 text-xs font-medium text-ink sm:col-span-2">
          <input type="checkbox" aria-label="อนุญาตให้เลี้ยงสัตว์" checked={spec.petAllowed} onChange={(e) => onChange({ petAllowed: e.target.checked })} />
          <span>อนุญาตให้เลี้ยงสัตว์ (Pet Friendly)</span>
        </label>
      </div>
    </div>
  );
}
