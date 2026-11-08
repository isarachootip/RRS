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
      return { land: { rai: 0, ngan: 0, sqWah: 50 }, stories: 2, parkingSlots: 2, commonFeePerMonth: 1500 };
    case "APARTMENT_UNIT":
      return { waterRatePerUnit: 18, electricRatePerUnit: 8, allowsDailyRent: false };
    case "APARTMENT_BUILDING":
      return { totalUnits: 20, totalFloors: 5, occupancyRatePercent: 85, monthlyIncome: 120000 };
    case "FACTORY":
    case "WAREHOUSE":
      return { buildingAreaSqm: 500, powerKva: 250, ceilingHeightM: 8, floorLoadTonPerSqm: 3, hasFactoryLicense: true };
    case "LAND":
      return { land: { rai: 1, ngan: 0, sqWah: 0 }, titleDeedType: "CHANOTE", frontageM: 20, zoning: "สีเหลือง" };
    case "COMMERCIAL":
      return { bays: 1, stories: 4, hasMezzanine: true, frontageM: 4, depthM: 12, parkingSlots: 2, land: { rai: 0, ngan: 0, sqWah: 20 } };
  }
}

const inputCls = "w-full rounded border border-line bg-surface px-2 py-1.5 text-sm text-ink";

function LandInputs({
  land,
  onSet,
}: {
  land: { rai?: number; ngan?: number; sqWah?: number };
  onSet: (k: "rai" | "ngan" | "sqWah", v: number) => void;
}) {
  return (
    <>
      <label className="space-y-1 text-xs font-medium text-ink"><span>ที่ดิน (ไร่)</span><input type="number" min={0} aria-label="ที่ดิน (ไร่)" value={Number(land.rai ?? 0)} onChange={(e) => onSet("rai", Number(e.target.value))} className={inputCls} /></label>
      <label className="space-y-1 text-xs font-medium text-ink"><span>งาน (0-3)</span><input type="number" min={0} max={3} aria-label="ที่ดิน (งาน)" value={Number(land.ngan ?? 0)} onChange={(e) => onSet("ngan", Number(e.target.value))} className={inputCls} /></label>
      <label className="space-y-1 text-xs font-medium text-ink"><span>ตารางวา</span><input type="number" min={0} step="0.1" aria-label="ที่ดิน (ตารางวา)" value={Number(land.sqWah ?? 0)} onChange={(e) => onSet("sqWah", Number(e.target.value))} className={inputCls} /></label>
    </>
  );
}

export function CategoryAttributesFields({ category, values, onChange }: CategoryAttributesFieldsProps) {
  const land = (values.land as { rai?: number; ngan?: number; sqWah?: number } | undefined) ?? { rai: 0, ngan: 0, sqWah: 50 };
  const setField = (key: string, val: unknown) => onChange({ ...values, [key]: val });
  const setNumOrUndef = (key: string, raw: string) => setField(key, raw === "" ? undefined : Number(raw));
  const setLandField = (key: "rai" | "ngan" | "sqWah", val: number) => onChange({ ...values, land: { ...land, [key]: val } });

  if (category === "CONDO") {
    return (
      <div className="grid gap-3 rounded-lg border border-line bg-surface-subtle p-4 sm:grid-cols-3">
        <label className="space-y-1 text-xs font-medium text-ink"><span>ค่าส่วนกลาง (บาท/ตร.ม.)</span><input type="number" aria-label="ค่าส่วนกลางต่อตารางเมตร" value={Number(values.commonFeePerSqm ?? 45)} onChange={(e) => setField("commonFeePerSqm", Number(e.target.value))} className={inputCls} /></label>
        <label className="space-y-1 text-xs font-medium text-ink"><span>สิทธิ์ที่จอดรถ (คัน)</span><input type="number" aria-label="สิทธิ์ที่จอดรถ" value={Number(values.parkingSlots ?? 1)} onChange={(e) => setField("parkingSlots", Number(e.target.value))} className={inputCls} /></label>
        <label className="space-y-1 text-xs font-medium text-ink"><span>ทิศระเบียง/ห้อง</span><input aria-label="ทิศระเบียง" value={String(values.facing ?? "")} onChange={(e) => setField("facing", e.target.value)} placeholder="เช่น ทิศเหนือ / วิวแม่น้ำ" className={inputCls} /></label>
      </div>
    );
  }

  if (category === "HOUSE" || category === "TOWNHOME") {
    return (
      <div className="grid gap-3 rounded-lg border border-line bg-surface-subtle p-4 sm:grid-cols-5">
        <LandInputs land={land} onSet={setLandField} />
        <label className="space-y-1 text-xs font-medium text-ink"><span>จำนวนชั้น *</span><input type="number" min={1} aria-label="จำนวนชั้นของบ้าน" value={Number(values.stories ?? 2)} onChange={(e) => setField("stories", Number(e.target.value))} className={inputCls} /></label>
        <label className="space-y-1 text-xs font-medium text-ink"><span>ที่จอดรถในบ้าน (คัน)</span><input type="number" min={0} aria-label="ที่จอดรถของบ้าน" value={Number(values.parkingSlots ?? 2)} onChange={(e) => setField("parkingSlots", Number(e.target.value))} className={inputCls} /></label>
      </div>
    );
  }

  if (category === "COMMERCIAL") {
    return (
      <div className="grid gap-3 rounded-lg border border-line bg-surface-subtle p-4 sm:grid-cols-4">
        <label className="space-y-1 text-xs font-medium text-ink"><span>จำนวนคูหา / ห้อง *</span><input type="number" min={1} aria-label="จำนวนคูหา" value={Number(values.bays ?? 1)} onChange={(e) => setField("bays", Number(e.target.value))} className={inputCls} /></label>
        <label className="space-y-1 text-xs font-medium text-ink"><span>จำนวนชั้น *</span><input type="number" min={1} aria-label="จำนวนชั้นอาคารพาณิชย์" value={Number(values.stories ?? 4)} onChange={(e) => setField("stories", Number(e.target.value))} className={inputCls} /></label>
        <label className="space-y-1 text-xs font-medium text-ink"><span>หน้ากว้างอาคาร (เมตร)</span><input type="number" step="0.5" aria-label="หน้ากว้างอาคาร (เมตร)" value={values.frontageM != null ? String(values.frontageM) : ""} onChange={(e) => setNumOrUndef("frontageM", e.target.value)} className={inputCls} /></label>
        <label className="space-y-1 text-xs font-medium text-ink"><span>ความลึกอาคาร (เมตร)</span><input type="number" step="0.5" aria-label="ความลึกอาคาร (เมตร)" value={values.depthM != null ? String(values.depthM) : ""} onChange={(e) => setNumOrUndef("depthM", e.target.value)} className={inputCls} /></label>
        <LandInputs land={land} onSet={setLandField} />
        <label className="flex items-center gap-2 pt-5 text-xs font-medium text-ink"><input type="checkbox" aria-label="มีชั้นลอย" checked={Boolean(values.hasMezzanine)} onChange={(e) => setField("hasMezzanine", e.target.checked)} /><span>มีชั้นลอย (Mezzanine)</span></label>
      </div>
    );
  }

  if (category === "LAND") {
    return (
      <div className="grid gap-3 rounded-lg border border-line bg-surface-subtle p-4 sm:grid-cols-4">
        <LandInputs land={land} onSet={setLandField} />
        <label className="space-y-1 text-xs font-medium text-ink">
          <span>เอกสารสิทธิ์ *</span>
          <select aria-label="ประเภทเอกสารสิทธิ์" value={String(values.titleDeedType ?? "CHANOTE")} onChange={(e) => setField("titleDeedType", e.target.value)} className={inputCls}>
            <option value="CHANOTE">โฉนดครุฑแดง (น.ส.4 จ.)</option>
            <option value="NOR_SOR_3_GOR">น.ส.3 ก.</option>
            <option value="NOR_SOR_3">น.ส.3</option>
            <option value="SOR_POR_KOR">ส.ป.ก.</option>
            <option value="OTHER">อื่นๆ</option>
          </select>
        </label>
        <label className="space-y-1 text-xs font-medium text-ink"><span>หน้ากว้างติดถนน (ม.)</span><input type="number" step="0.5" aria-label="หน้ากว้างติดถนน" value={values.frontageM != null ? String(values.frontageM) : ""} onChange={(e) => setNumOrUndef("frontageM", e.target.value)} className={inputCls} /></label>
        <label className="space-y-1 text-xs font-medium text-ink"><span>ผังเมือง (สี)</span><input aria-label="ผังเมือง" value={String(values.zoning ?? "")} onChange={(e) => setField("zoning", e.target.value)} placeholder="เช่น สีเหลือง / สีม่วง" className={inputCls} /></label>
        <label className="space-y-1 text-xs font-medium text-ink sm:col-span-2"><span>ถนนหน้าที่ดิน / ทางเข้าออก</span><input aria-label="ถนนหน้าที่ดิน" value={String(values.roadAccess ?? "")} onChange={(e) => setField("roadAccess", e.target.value)} placeholder="เช่น ถนนคอนกรีต 8 เมตร รถพ่วงเข้าได้" className={inputCls} /></label>
      </div>
    );
  }

  if (category === "FACTORY" || category === "WAREHOUSE") {
    return (
      <div className="grid gap-3 rounded-lg border border-line bg-surface-subtle p-4 sm:grid-cols-4">
        <label className="space-y-1 text-xs font-medium text-ink"><span>พื้นที่อาคารโรงงาน (ตร.ม.) *</span><input type="number" aria-label="พื้นที่อาคารโรงงาน" value={Number(values.buildingAreaSqm ?? 500)} onChange={(e) => setField("buildingAreaSqm", Number(e.target.value))} className={inputCls} /></label>
        <label className="space-y-1 text-xs font-medium text-ink"><span>หม้อแปลงไฟฟ้า (kVA)</span><input type="number" aria-label="หม้อแปลงไฟฟ้า (kVA)" value={Number(values.powerKva ?? 250)} onChange={(e) => setField("powerKva", Number(e.target.value))} className={inputCls} /></label>
        <label className="space-y-1 text-xs font-medium text-ink"><span>ความสูงเพดาน (ม.)</span><input type="number" step="0.5" aria-label="ความสูงเพดาน" value={values.ceilingHeightM != null ? String(values.ceilingHeightM) : ""} onChange={(e) => setNumOrUndef("ceilingHeightM", e.target.value)} className={inputCls} /></label>
        <label className="flex items-center gap-2 pt-5 text-xs font-medium text-ink"><input type="checkbox" checked={Boolean(values.hasFactoryLicense)} onChange={(e) => setField("hasFactoryLicense", e.target.checked)} /><span>ขอใบอนุญาต รง.4 ได้</span></label>
      </div>
    );
  }

  if (category === "APARTMENT_UNIT") {
    return (
      <div className="grid gap-3 rounded-lg border border-line bg-surface-subtle p-4 sm:grid-cols-3">
        <label className="space-y-1 text-xs font-medium text-ink"><span>ค่าน้ำ (บาท/ยูนิต)</span><input type="number" aria-label="ค่าน้ำต่อยูนิต" value={Number(values.waterRatePerUnit ?? 18)} onChange={(e) => setField("waterRatePerUnit", Number(e.target.value))} className={inputCls} /></label>
        <label className="space-y-1 text-xs font-medium text-ink"><span>ค่าไฟ (บาท/ยูนิต)</span><input type="number" aria-label="ค่าไฟต่อยูนิต" value={Number(values.electricRatePerUnit ?? 8)} onChange={(e) => setField("electricRatePerUnit", Number(e.target.value))} className={inputCls} /></label>
        <label className="flex items-center gap-2 pt-5 text-xs font-medium text-ink"><input type="checkbox" checked={Boolean(values.allowsDailyRent)} onChange={(e) => setField("allowsDailyRent", e.target.checked)} /><span>รองรับเช่ารายวัน</span></label>
      </div>
    );
  }

  return (
    <div className="grid gap-3 rounded-lg border border-line bg-surface-subtle p-4 sm:grid-cols-3">
      <label className="space-y-1 text-xs font-medium text-ink"><span>จำนวนห้องทั้งหมด *</span><input type="number" aria-label="จำนวนห้องทั้งหมด" value={Number(values.totalUnits ?? 20)} onChange={(e) => setField("totalUnits", Number(e.target.value))} className={inputCls} /></label>
      <label className="space-y-1 text-xs font-medium text-ink"><span>จำนวนชั้นทั้งหมด *</span><input type="number" aria-label="จำนวนชั้นทั้งหมด" value={Number(values.totalFloors ?? 5)} onChange={(e) => setField("totalFloors", Number(e.target.value))} className={inputCls} /></label>
      <label className="space-y-1 text-xs font-medium text-ink"><span>อัตราผู้เช่า (%)</span><input type="number" aria-label="อัตราผู้เช่า" value={Number(values.occupancyRatePercent ?? 85)} onChange={(e) => setField("occupancyRatePercent", Number(e.target.value))} className={inputCls} /></label>
    </div>
  );
}
