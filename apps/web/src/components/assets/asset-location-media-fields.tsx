"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";

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

export function parseGoogleMapsCoords(raw: string): { lat: string; lng: string } | null {
  const text = raw.trim();
  if (!text) return null;
  const patterns = [
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,
    /[?&](?:q|ll|query)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/,
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
    /^(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)$/,
  ];
  for (const regex of patterns) {
    const match = text.match(regex);
    if (match?.[1] && match?.[2]) {
      const lat = Number(match[1]);
      const lng = Number(match[2]);
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return { lat: String(lat), lng: String(lng) };
      }
    }
  }
  return null;
}

interface AssetLocationMediaFieldsProps {
  loc: AssetLocationState;
  onChange: (patch: Partial<AssetLocationState>) => void;
  pendingPhotos: File[];
  onPendingPhotosChange: (files: File[]) => void;
}

export function AssetLocationMediaFields({
  loc,
  onChange,
  pendingPhotos,
  onPendingPhotosChange,
}: AssetLocationMediaFieldsProps) {
  const [mapUrlInput, setMapUrlInput] = useState("");

  const { data: projectsData } = useQuery({
    queryKey: ["projects-options"],
    queryFn: () => api<{ items: Array<{ id: string; name: string }> }>("/api/v1/projects"),
  });

  function handleMapUrlChange(val: string) {
    setMapUrlInput(val);
    const parsed = parseGoogleMapsCoords(val);
    if (parsed) {
      onChange({ latitude: parsed.lat, longitude: parsed.lng });
    }
  }

  function handleSelectFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length > 0) {
      onPendingPhotosChange([...pendingPhotos, ...selected]);
    }
    e.target.value = "";
  }

  const inputCls = "w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink";
  const hasCoords = loc.latitude.trim() !== "" && loc.longitude.trim() !== "";

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-lg border border-line bg-surface-subtle p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            สถานที่ตั้ง และพิกัดแผนที่ (Location & Coordinates)
          </h3>
          {hasCoords && (
            <a
              href={`https://www.google.com/maps?q=${encodeURIComponent(`${loc.latitude},${loc.longitude}`)}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-medium text-brand hover:underline"
            >
              📍 เปิดดูพิกัดบน Google Maps ↗
            </a>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="space-y-1 text-xs font-medium text-ink sm:col-span-1">
            <span>โครงการ (Project)</span>
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
          <label className="space-y-1 text-xs font-medium text-ink">
            <span>อาคาร / ตึก (Tower)</span>
            <input aria-label="อาคารหรือตึก" value={loc.tower} onChange={(e) => onChange({ tower: e.target.value })} placeholder="เช่น Building A" className={inputCls} />
          </label>
          <label className="space-y-1 text-xs font-medium text-ink">
            <span>ชั้น (Floor)</span>
            <input type="number" aria-label="ชั้น" value={loc.floor} onChange={(e) => onChange({ floor: e.target.value })} placeholder="เช่น 12" className={inputCls} />
          </label>
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
          <label className="space-y-1 text-xs font-medium text-ink sm:col-span-3">
            <span>วางลิงก์ Google Maps หรือพิกัด (ดึง Latitude / Longitude อัตโนมัติ)</span>
            <input
              aria-label="วางลิงก์ Google Maps"
              value={mapUrlInput}
              onChange={(e) => handleMapUrlChange(e.target.value)}
              placeholder="วางลิงก์ Google Maps ที่มี @13.7563,100.5018 หรือพิมพ์ 13.7563, 100.5018"
              className={inputCls}
            />
          </label>
          <label className="space-y-1 text-xs font-medium text-ink">
            <span>ละติจูด (Latitude)</span>
            <input type="number" step="any" aria-label="ละติจูด" value={loc.latitude} onChange={(e) => onChange({ latitude: e.target.value })} placeholder="เช่น 13.7563" className={inputCls} />
          </label>
          <label className="space-y-1 text-xs font-medium text-ink sm:col-span-2">
            <span>ลองจิจูด (Longitude)</span>
            <input type="number" step="any" aria-label="ลองจิจูด" value={loc.longitude} onChange={(e) => onChange({ longitude: e.target.value })} placeholder="เช่น 100.5018" className={inputCls} />
          </label>
        </div>
      </div>

      <div className="space-y-2 rounded-lg border border-line bg-surface-subtle p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              รูปภาพห้อง และสถานที่ (Room & Place Photos)
            </h3>
            <p className="text-xs text-ink-muted">เลือกรูปภาพห้อง อาคาร หรือสถานที่จริง (JPG, PNG, WEBP เลือกได้หลายรูป)</p>
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
