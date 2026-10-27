"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { t } from "@/i18n/th";
import { api } from "@/lib/api";

interface OwnerOption {
  id: string;
  code: string;
  fullName: string;
}

interface BulkApartmentModalProps {
  onClose: () => void;
  onSaved: () => void;
}

export function BulkApartmentModal({ onClose, onSaved }: BulkApartmentModalProps) {
  const [buildingName, setBuildingName] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [floor, setFloor] = useState("2");
  const [unitCount, setUnitCount] = useState("10");
  const [startUnitNo, setStartUnitNo] = useState("201");
  const [areaSqm, setAreaSqm] = useState("24");
  const [rentPrice, setRentPrice] = useState("4500");
  const [waterRate, setWaterRate] = useState("18");
  const [electricRate, setElectricRate] = useState("8");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: ownersData } = useQuery({
    queryKey: ["owners-options"],
    queryFn: () => api<{ items: OwnerOption[] }>("/api/v1/owners?pageSize=50"),
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSaving(true);
    try {
      const building = await api<{ id: string }>("/api/v1/buildings", {
        method: "POST",
        body: JSON.stringify({
          name: buildingName.trim(),
          ownerId,
          totalFloors: Math.max(1, Number(floor)),
        }),
      });

      const count = Math.min(100, Math.max(1, Number(unitCount)));
      const baseNo = Number(startUnitNo) || 101;
      const units = Array.from({ length: count }, (_, idx) => ({
        unitNo: String(baseNo + idx),
        floor: Number(floor) || 1,
        areaSqm: Number(areaSqm) || 24,
        rentPrice: Number(rentPrice) || 4500,
        attributes: {
          waterRatePerUnit: Number(waterRate) || 18,
          electricRatePerUnit: Number(electricRate) || 8,
          allowsDailyRent: false,
        },
      }));

      await api(`/api/v1/buildings/${building.id}/bulk-units`, {
        method: "POST",
        body: JSON.stringify({ units }),
      });
      onSaved();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "สร้างห้องอพาร์ตเมนต์แบบกลุ่มไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg space-y-4 rounded-lg border border-line bg-surface p-6 shadow-lg"
      >
        <h2 className="text-lg font-semibold text-ink">{t("assets.bulkAdd")}</h2>
        {errorMsg && <p className="rounded bg-danger/10 p-2 text-xs text-danger">{errorMsg}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-xs font-medium text-ink sm:col-span-2">
            <span>ชื่ออาคารอพาร์ตเมนต์ *</span>
            <input
              required
              aria-label="ชื่ออาคารอพาร์ตเมนต์"
              value={buildingName}
              onChange={(e) => setBuildingName(e.target.value)}
              placeholder="เช่น สุขใจแมนชั่น"
              className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1 text-xs font-medium text-ink sm:col-span-2">
            <span>เจ้าของอาคาร *</span>
            <select
              required
              aria-label="เจ้าของอาคารอพาร์ตเมนต์"
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm"
            >
              <option value="">-- เลือกเจ้าของอาคาร --</option>
              {(ownersData?.items ?? []).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.code} — {o.fullName}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium text-ink">
            <span>จำนวนห้องที่จะสร้างพร้อมกัน *</span>
            <input
              type="number"
              min={1}
              max={100}
              aria-label="จำนวนห้องที่จะสร้างพร้อมกัน"
              value={unitCount}
              onChange={(e) => setUnitCount(e.target.value)}
              className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1 text-xs font-medium text-ink">
            <span>เลขห้องเริ่มต้น *</span>
            <input
              aria-label="เลขห้องเริ่มต้น"
              value={startUnitNo}
              onChange={(e) => setStartUnitNo(e.target.value)}
              className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1 text-xs font-medium text-ink">
            <span>ชั้น</span>
            <input
              type="number"
              aria-label="ชั้นของห้อง"
              value={floor}
              onChange={(e) => setFloor(e.target.value)}
              className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1 text-xs font-medium text-ink">
            <span>ขนาดห้อง (ตร.ม.)</span>
            <input
              type="number"
              aria-label="ขนาดห้องอพาร์ตเมนต์"
              value={areaSqm}
              onChange={(e) => setAreaSqm(e.target.value)}
              className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1 text-xs font-medium text-ink">
            <span>ค่าเช่าต่อเดือน (บาท)</span>
            <input
              type="number"
              aria-label="ค่าเช่าห้องอพาร์ตเมนต์"
              value={rentPrice}
              onChange={(e) => setRentPrice(e.target.value)}
              className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1 text-xs font-medium text-ink">
            <span>ค่าน้ำ / ค่าไฟ (บาท/หน่วย)</span>
            <div className="flex gap-1">
              <input
                type="number"
                aria-label="ค่าน้ำต่อหน่วย"
                value={waterRate}
                onChange={(e) => setWaterRate(e.target.value)}
                className="w-1/2 rounded-md border border-line bg-surface px-2 py-2 text-sm"
              />
              <input
                type="number"
                aria-label="ค่าไฟต่อหน่วย"
                value={electricRate}
                onChange={(e) => setElectricRate(e.target.value)}
                className="w-1/2 rounded-md border border-line bg-surface px-2 py-2 text-sm"
              />
            </div>
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-md border border-line px-4 py-2 text-xs text-ink">
            {t("archive.cancel")}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-brand px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
          >
            สร้างอาคารและห้องทั้งหมด
          </button>
        </div>
      </form>
    </div>
  );
}
