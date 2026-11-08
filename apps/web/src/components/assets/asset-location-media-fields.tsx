"use client";

import { useQuery } from "@tanstack/react-query";
import type { AssetCategory } from "@rrs/shared";
import { api } from "@/lib/api";
import { isVerticalUnitCategory } from "./asset-unit-spec-fields";
import { GoogleLocationPicker, parseGoogleMapsCoords } from "./google-location-picker";

export { parseGoogleMapsCoords };

export interface AssetLocationState {
  projectId: string;
  tower: string;
  floor: string;
  address: string;
  district: string;
  province: string;
  latitude: string;
  longitude: string;
}

interface AssetLocationMediaFieldsProps {
  category?: AssetCategory;
  loc: AssetLocationState;
  onChange: (patch: Partial<AssetLocationState>) => void;
  pendingPhotos: File[];
  onPendingPhotosChange: (files: File[]) => void;
}

export function AssetLocationMediaFields({
  category = "CONDO",
  loc,
  onChange,
  pendingPhotos,
  onPendingPhotosChange,
}: AssetLocationMediaFieldsProps) {
  const { data: projectsData } = useQuery({
    queryKey: ["projects-options"],
    queryFn: () => api<{ items: Array<{ id: string; name: string }> }>("/api/v1/projects"),
  });

  const showVertical = isVerticalUnitCategory(category);
  const projectLabel =
    category === "HOUSE" || category === "TOWNHOME"
      ? "โครงการ / หมู่บ้านจัดสรร (Project)"
      : category === "CONDO"
        ? "โครงการคอนโด (Project)"
        : "โครงการ / ทำเลอ้างอิง (ถ้ามี)";

  const selectedProjectName = (projectsData?.items ?? []).find((p) => p.id === loc.projectId)?.name ?? "";
  const defaultMapQuery = [selectedProjectName, loc.address, loc.district, loc.province].filter(Boolean).join(" ");

  function handleSelectFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length > 0) {
      onPendingPhotosChange([...pendingPhotos, ...selected]);
    }
    e.target.value = "";
  }

  const inputCls = "w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink";

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-lg border border-line bg-surface-subtle p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          สถานที่ตั้ง และพิกัดแผนที่ (Location & Google Maps)
        </h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className={`space-y-1 text-xs font-medium text-ink ${showVertical ? "sm:col-span-1" : "sm:col-span-3"}`}>
            <span>{projectLabel}</span>
            <select
              aria-label="โครงการ"
              value={loc.projectId}
              onChange={(e) => onChange({ projectId: e.target.value })}
              className={inputCls}
            >
              <option value="">-- ไม่ระบุโครงการ --</option>
              {(projectsData?.items ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          {showVertical && (
            <>
              <label className="space-y-1 text-xs font-medium text-ink">
                <span>อาคาร / ตึก (Tower)</span>
                <input aria-label="อาคารหรือตึก" value={loc.tower} onChange={(e) => onChange({ tower: e.target.value })} placeholder="เช่น Building A" className={inputCls} />
              </label>
              <label className="space-y-1 text-xs font-medium text-ink">
                <span>ชั้นที่อยู่ (Floor)</span>
                <input type="number" aria-label="ชั้น" value={loc.floor} onChange={(e) => onChange({ floor: e.target.value })} placeholder="เช่น 12" className={inputCls} />
              </label>
            </>
          )}
          <label className="space-y-1 text-xs font-medium text-ink sm:col-span-3">
            <span>ที่อยู่ / ซอย / ถนน / สถานที่ตั้ง</span>
            <input aria-label="ที่อยู่หรือสถานที่ตั้ง" value={loc.address} onChange={(e) => onChange({ address: e.target.value })} placeholder="เช่น ซอยสุขุมวิท 24 ใกล้ BTS พร้อมพงษ์" className={inputCls} />
          </label>
          <label className="space-y-1 text-xs font-medium text-ink">
            <span>เขต / อำเภอ</span>
            <input aria-label="เขตหรืออำเภอ" value={loc.district} onChange={(e) => onChange({ district: e.target.value })} placeholder="เช่น คลองเตย" className={inputCls} />
          </label>
          <label className="space-y-1 text-xs font-medium text-ink sm:col-span-2">
            <span>จังหวัด</span>
            <input aria-label="จังหวัด" value={loc.province} onChange={(e) => onChange({ province: e.target.value })} placeholder="เช่น กรุงเทพมหานคร" className={inputCls} />
          </label>

          <GoogleLocationPicker
            latitude={loc.latitude}
            longitude={loc.longitude}
            defaultQuery={defaultMapQuery}
            onSelect={(patch) => onChange(patch)}
          />
        </div>
      </div>

      <div className="space-y-2 rounded-lg border border-line bg-surface-subtle p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              รูปภาพทรัพย์สิน และสถานที่จริง (Property & Place Photos)
            </h3>
            <p className="text-xs text-ink-muted">เลือกรูปภาพทรัพย์สิน อาคาร หรือสถานที่จริง (JPG, PNG, WEBP เลือกได้หลายรูป)</p>
          </div>
          <label className="cursor-pointer rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white hover:opacity-90">
            + เลือกรูปภาพห้อง/สถานที่
            <input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={handleSelectFiles} className="hidden" />
          </label>
        </div>
        {pendingPhotos.length > 0 && (
          <ul className="flex flex-wrap gap-2 pt-1">
            {pendingPhotos.map((file, idx) => (
              <li key={`${file.name}-${idx}`} className="flex items-center gap-1.5 rounded border border-line bg-surface px-2.5 py-1 text-xs text-ink">
                <span>🖼️ {file.name}</span>
                <button
                  type="button"
                  onClick={() => onPendingPhotosChange(pendingPhotos.filter((_, i) => i !== idx))}
                  className="text-danger hover:underline"
                >
                  ลบ
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
