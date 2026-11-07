"use client";

import { useState } from "react";

export interface PickedLocationPatch {
  latitude?: string;
  longitude?: string;
  address?: string;
  district?: string;
  province?: string;
}

interface SearchPlaceItem {
  display_name: string;
  lat: string;
  lon: string;
  address?: Record<string, string | undefined>;
}

export function parseGoogleMapsCoords(raw: string): { lat: string; lng: string } | null {
  const text = raw.trim();
  if (!text) return null;
  const patterns = [
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,
    /[?&](?:q|ll|query|center)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/,
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

export function GoogleLocationPicker({
  latitude,
  longitude,
  defaultQuery,
  onSelect,
}: {
  latitude: string;
  longitude: string;
  defaultQuery?: string;
  onSelect: (patch: PickedLocationPatch) => void;
}) {
  const [searchInput, setSearchInput] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchPlaceItem[]>([]);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const hasCoords = latitude.trim() !== "" && longitude.trim() !== "";
  const mapQuery = hasCoords
    ? `${latitude.trim()},${longitude.trim()}`
    : (searchInput.trim() || defaultQuery?.trim() || "กรุงเทพมหานคร");
  const embedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&hl=th&z=16&output=embed`;

  function handleInputChange(val: string) {
    setSearchInput(val);
    setStatusMsg(null);
    const parsed = parseGoogleMapsCoords(val);
    if (parsed) {
      onSelect({ latitude: parsed.lat, longitude: parsed.lng });
      setResults([]);
      setStatusMsg(`✓ ดึงพิกัดจาก Google Maps เรียบร้อย (${parsed.lat}, ${parsed.lng})`);
    }
  }

  async function handleSearchPlace() {
    const q = (searchInput.trim() || defaultQuery?.trim() || "").trim();
    if (!q) return;
    const parsed = parseGoogleMapsCoords(q);
    if (parsed) {
      onSelect({ latitude: parsed.lat, longitude: parsed.lng });
      return;
    }
    setSearching(true);
    setStatusMsg(null);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&accept-language=th&q=${encodeURIComponent(q)}`;
      const res = await fetch(url);
      const data = (await res.json()) as SearchPlaceItem[];
      setResults(Array.isArray(data) ? data : []);
      if (!data?.length) setStatusMsg("ไม่พบชื่อสถานที่นี้ ลองพิมพ์ชื่อเขต/ถนน หรือวางลิงก์จาก Google Maps");
    } catch {
      setStatusMsg("ไม่สามารถค้นหาสถานที่ได้ กรุณาวางลิงก์จาก Google Maps");
    } finally {
      setSearching(false);
    }
  }

  function handlePickResult(item: SearchPlaceItem) {
    const addr = item.address;
    const district = addr?.city_district || addr?.district || addr?.county || addr?.suburb;
    const province = addr?.state || addr?.province || addr?.city;
    onSelect({
      latitude: Number(item.lat).toFixed(6),
      longitude: Number(item.lon).toFixed(6),
      address: item.display_name.split(",").slice(0, 2).join(", ").trim(),
      ...(district ? { district: district.replace(/^เขต/, "").trim() } : {}),
      ...(province ? { province: province.replace(/^จังหวัด/, "").trim() } : {}),
    });
    setResults([]);
    setStatusMsg(`✓ เลือกตำแหน่ง: ${item.display_name.split(",")[0]}`);
  }

  function handleUseCurrentGps() {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);
        onSelect({ latitude: lat, longitude: lng });
        setStatusMsg(`✓ ใช้ตำแหน่งปัจจุบันเรียบร้อย (${lat}, ${lng})`);
      },
      () => setStatusMsg("ไม่สามารถดึงพิกัด GPS ได้ กรุณาอนุญาตการเข้าถึงตำแหน่ง"),
    );
  }

  function nudgeCoord(dLat: number, dLng: number) {
    const baseLat = Number(latitude) || 13.7563;
    const baseLng = Number(longitude) || 100.5018;
    onSelect({ latitude: (baseLat + dLat).toFixed(6), longitude: (baseLng + dLng).toFixed(6) });
  }

  return (
    <div className="space-y-2.5 sm:col-span-3" data-testid="google-location-picker">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-ink">📍 เลือกตำแหน่งจาก Google Maps (ค้นหาชื่อสถานที่ หรือวางลิงก์)</span>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={handleUseCurrentGps} className="rounded border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink hover:bg-surface-subtle">
            🎯 ใช้ตำแหน่งปัจจุบัน (GPS)
          </button>
          <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`} target="_blank" rel="noreferrer" className="rounded border border-brand bg-surface px-2.5 py-1 text-xs font-medium text-brand hover:underline">
            🗺️ เปิดเลือกใน Google Maps ↗
          </a>
        </div>
      </div>

      <div className="flex gap-2">
        <input
          aria-label="วางลิงก์ Google Maps"
          value={searchInput}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void handleSearchPlace();
            }
          }}
          placeholder="พิมพ์ชื่อสถานที่ เช่น ลาดพร้าว สเตชั่น, สุขุมวิท 24 หรือวางลิงก์ Google Maps..."
          className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink"
        />
        <button type="button" disabled={searching} onClick={() => void handleSearchPlace()} className="shrink-0 rounded-md bg-brand px-3.5 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50">
          {searching ? "กำลังค้นหา..." : "🔍 ค้นหาสถานที่"}
        </button>
      </div>

      {statusMsg && <p className="text-xs font-medium text-brand">{statusMsg}</p>}

      {results.length > 0 && (
        <ul className="max-h-40 divide-y divide-line overflow-y-auto rounded-md border border-line bg-surface text-xs shadow-sm">
          {results.map((r, i) => (
            <li key={`${r.lat}-${r.lon}-${i}`}>
              <button type="button" onClick={() => handlePickResult(r)} className="w-full px-3 py-2 text-left hover:bg-surface-subtle">
                <span className="font-semibold text-brand">📌 เลือกที่นี่:</span> {r.display_name}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="overflow-hidden rounded-lg border border-line bg-surface">
        <iframe title="Google Maps Location Preview" src={embedUrl} className="h-48 w-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-surface px-3 py-2 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-ink-muted">ปรับขยับหมุด:</span>
            <button type="button" onClick={() => nudgeCoord(0.0005, 0)} className="rounded border border-line px-2 py-0.5 hover:bg-surface-subtle">⬆️ เหนือ</button>
            <button type="button" onClick={() => nudgeCoord(-0.0005, 0)} className="rounded border border-line px-2 py-0.5 hover:bg-surface-subtle">⬇️ ใต้</button>
            <button type="button" onClick={() => nudgeCoord(0, -0.0005)} className="rounded border border-line px-2 py-0.5 hover:bg-surface-subtle">⬅️ ซ้าย</button>
            <button type="button" onClick={() => nudgeCoord(0, 0.0005)} className="rounded border border-line px-2 py-0.5 hover:bg-surface-subtle">➡️ ขวา</button>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1"><span className="text-ink-muted">Lat:</span><input type="number" step="any" aria-label="ละติจูด" value={latitude} onChange={(e) => onSelect({ latitude: e.target.value })} placeholder="13.7563" className="w-24 rounded border border-line px-2 py-0.5 text-xs" /></label>
            <label className="flex items-center gap-1"><span className="text-ink-muted">Lng:</span><input type="number" step="any" aria-label="ลองจิจูด" value={longitude} onChange={(e) => onSelect({ longitude: e.target.value })} placeholder="100.5018" className="w-24 rounded border border-line px-2 py-0.5 text-xs" /></label>
          </div>
        </div>
      </div>
    </div>
  );
}
