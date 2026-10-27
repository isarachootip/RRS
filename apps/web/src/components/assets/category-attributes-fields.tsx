"use client";

import type { AssetCategory } from "@rrs/shared";

interface CategoryAttributesFieldsProps {
  category: AssetCategory;
  values: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}

export function defaultAttributesForCategory(category: AssetCategory): Record<string, unknown> {
  switch (category) {
    case "CONDO":
      return { commonFeePerSqm: 45, parkingSlots: 1, facing: "ทิศใต้" };
    case "HOUSE":
    case "TOWNHOME":
      return { land: { rai: 0, ngan: 0, sqWah: 50 }, stories: 2, parkingSlots: 2 };
    case "APARTMENT_UNIT":
      return { waterRatePerUnit: 18, electricRatePerUnit: 8, allowsDailyRent: false };
    case "APARTMENT_BUILDING":
      return { totalUnits: 20, totalFloors: 5 };
    case "FACTORY":
    case "WAREHOUSE":
      return { buildingAreaSqm: 500, powerKva: 250, hasFactoryLicense: true };
    case "LAND":
      return { land: { rai: 1, ngan: 0, sqWah: 0 }, titleDeedType: "CHANOTE" };
    case "COMMERCIAL":
      return { stories: 4, parkingSlots: 2 };
  }
}

export function CategoryAttributesFields({ category, values, onChange }: CategoryAttributesFieldsProps) {
  const land = (values.land as { rai?: number; ngan?: number; sqWah?: number } | undefined) ?? {
    rai: 0,
    ngan: 0,
    sqWah: 50,
  };

  function setField(key: string, val: unknown) {
    onChange({ ...values, [key]: val });
  }

  function setLandField(key: "rai" | "ngan" | "sqWah", val: number) {
    onChange({ ...values, land: { ...land, [key]: val } });
  }

  if (category === "CONDO") {
    return (
      <div className="grid gap-3 rounded-md border border-line bg-surface-subtle p-3 sm:grid-cols-3">
        <label className="space-y-1 text-xs font-medium text-ink">
          <span>ค่าส่วนกลาง (บาท/ตร.ม.)</span>
          <input
            type="number"
            aria-label="ค่าส่วนกลางต่อตารางเมตร"
            value={Number(values.commonFeePerSqm ?? 45)}
            onChange={(e) => setField("commonFeePerSqm", Number(e.target.value))}
            className="w-full rounded border border-line bg-surface px-2 py-1.5 text-sm"
          />
        </label>
        <label className="space-y-1 text-xs font-medium text-ink">
          <span>สิทธิ์ที่จอดรถ (คัน)</span>
          <input
            type="number"
            aria-label="สิทธิ์ที่จอดรถ"
            value={Number(values.parkingSlots ?? 1)}
            onChange={(e) => setField("parkingSlots", Number(e.target.value))}
            className="w-full rounded border border-line bg-surface px-2 py-1.5 text-sm"
          />
        </label>
        <label className="space-y-1 text-xs font-medium text-ink">
          <span>ทิศระเบียง/ห้อง</span>
          <input
            aria-label="ทิศระเบียง"
            value={String(values.facing ?? "")}
            onChange={(e) => setField("facing", e.target.value)}
            className="w-full rounded border border-line bg-surface px-2 py-1.5 text-sm"
          />
        </label>
      </div>
    );
  }

  if (category === "HOUSE" || category === "TOWNHOME") {
    return (
      <div className="grid gap-3 rounded-md border border-line bg-surface-subtle p-3 sm:grid-cols-4">
        <label className="space-y-1 text-xs font-medium text-ink">
          <span>ที่ดิน (ไร่)</span>
          <input
            type="number"
            aria-label="ที่ดิน (ไร่)"
            value={Number(land.rai ?? 0)}
            onChange={(e) => setLandField("rai", Number(e.target.value))}
            className="w-full rounded border border-line bg-surface px-2 py-1.5 text-sm"
          />
        </label>
        <label className="space-y-1 text-xs font-medium text-ink">
          <span>งาน (0-3)</span>
          <input
            type="number"
            aria-label="ที่ดิน (งาน)"
            value={Number(land.ngan ?? 0)}
            onChange={(e) => setLandField("ngan", Number(e.target.value))}
            className="w-full rounded border border-line bg-surface px-2 py-1.5 text-sm"
          />
        </label>
        <label className="space-y-1 text-xs font-medium text-ink">
          <span>ตารางวา</span>
          <input
            type="number"
            aria-label="ที่ดิน (ตารางวา)"
            value={Number(land.sqWah ?? 50)}
            onChange={(e) => setLandField("sqWah", Number(e.target.value))}
            className="w-full rounded border border-line bg-surface px-2 py-1.5 text-sm"
          />
        </label>
        <label className="space-y-1 text-xs font-medium text-ink">
          <span>จำนวนชั้น *</span>
          <input
            type="number"
            aria-label="จำนวนชั้นของบ้าน"
            value={Number(values.stories ?? 2)}
            onChange={(e) => setField("stories", Number(e.target.value))}
            className="w-full rounded border border-line bg-surface px-2 py-1.5 text-sm"
          />
        </label>
      </div>
    );
  }

  if (category === "FACTORY" || category === "WAREHOUSE") {
    return (
      <div className="grid gap-3 rounded-md border border-line bg-surface-subtle p-3 sm:grid-cols-3">
        <label className="space-y-1 text-xs font-medium text-ink">
          <span>พื้นที่อาคารโรงงาน (ตร.ม.) *</span>
          <input
            type="number"
            aria-label="พื้นที่อาคารโรงงาน"
            value={Number(values.buildingAreaSqm ?? 500)}
            onChange={(e) => setField("buildingAreaSqm", Number(e.target.value))}
            className="w-full rounded border border-line bg-surface px-2 py-1.5 text-sm"
          />
        </label>
        <label className="space-y-1 text-xs font-medium text-ink">
          <span>หม้อแปลงไฟฟ้า (kVA)</span>
          <input
            type="number"
            aria-label="หม้อแปลงไฟฟ้า (kVA)"
            value={Number(values.powerKva ?? 250)}
            onChange={(e) => setField("powerKva", Number(e.target.value))}
            className="w-full rounded border border-line bg-surface px-2 py-1.5 text-sm"
          />
        </label>
        <label className="flex items-center gap-2 pt-5 text-xs font-medium text-ink">
          <input
            type="checkbox"
            checked={Boolean(values.hasFactoryLicense)}
            onChange={(e) => setField("hasFactoryLicense", e.target.checked)}
          />
          <span>ขอใบอนุญาต รง.4 ได้</span>
        </label>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-line bg-surface-subtle p-3 text-xs text-ink-muted">
      ตั้งค่าข้อมูลเฉพาะสำหรับประเภท {category} เรียบร้อยแล้ว
    </div>
  );
}
