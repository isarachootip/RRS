"use client";

import { useQuery } from "@tanstack/react-query";
import { ASSET_CATEGORIES, type AssetCategory, parseAssetAttributes } from "@rrs/shared";
import { useState } from "react";
import { type MessageKey, t } from "@/i18n/th";
import { api } from "@/lib/api";
import { CategoryAttributesFields, defaultAttributesForCategory } from "./category-attributes-fields";

interface OwnerOption {
  id: string;
  code: string;
  fullName: string;
}

interface AssetFormModalProps {
  onClose: () => void;
  onSaved: () => void;
}

export function AssetFormModal({ onClose, onSaved }: AssetFormModalProps) {
  const [category, setCategory] = useState<AssetCategory>("CONDO");
  const [ownershipType, setOwnershipType] = useState<"OWNER" | "AGENT">("AGENT");
  const [ownerId, setOwnerId] = useState("");
  const [unitNo, setUnitNo] = useState("");
  const [areaSqm, setAreaSqm] = useState("35");
  const [rentPrice, setRentPrice] = useState("15000");
  const [minRentPrice, setMinRentPrice] = useState("14000");
  const [attributes, setAttributes] = useState<Record<string, unknown>>(() => defaultAttributesForCategory("CONDO"));
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: ownersData } = useQuery({
    queryKey: ["owners-options"],
    queryFn: () => api<{ items: OwnerOption[] }>("/api/v1/owners?pageSize=50"),
  });

  function handleCategoryChange(nextCat: AssetCategory) {
    setCategory(nextCat);
    setAttributes(defaultAttributesForCategory(nextCat));
    setErrorMsg(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    let parsedAttrs: unknown;
    try {
      parsedAttrs = parseAssetAttributes(category, attributes);
    } catch {
      setErrorMsg(`ข้อมูลเฉพาะของประเภท ${t(`assets.cat.${category}` as MessageKey)} ไม่ครบถ้วนหรือมีค่าไม่ถูกต้อง`);
      return;
    }

    setSaving(true);
    try {
      await api("/api/v1/assets", {
        method: "POST",
        body: JSON.stringify({
          category,
          ownershipType,
          ownerId: ownershipType === "AGENT" ? ownerId || undefined : undefined,
          unitNo: unitNo.trim() || null,
          areaSqm: areaSqm ? Number(areaSqm) : null,
          rentPrice: rentPrice ? Number(rentPrice) : null,
          minRentPrice: minRentPrice ? Number(minRentPrice) : null,
          attributes: parsedAttrs,
        }),
      });
      onSaved();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "บันทึกทรัพย์สินไม่สำเร็จ");
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
        className="max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-lg border border-line bg-surface p-6 shadow-lg"
      >
        <h2 className="text-lg font-semibold text-ink">{t("assets.add")}</h2>
        {errorMsg && <p className="rounded bg-danger/10 p-2 text-xs text-danger">{errorMsg}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-xs font-medium text-ink">
            <span>ประเภทสินทรัพย์ *</span>
            <select
              aria-label="ประเภทสินทรัพย์"
              value={category}
              onChange={(e) => handleCategoryChange(e.target.value as AssetCategory)}
              className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm"
            >
              {ASSET_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`assets.cat.${c}` as MessageKey)}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium text-ink">
            <span>รูปแบบความเป็นเจ้าของ *</span>
            <select
              aria-label="รูปแบบความเป็นเจ้าของ"
              value={ownershipType}
              onChange={(e) => setOwnershipType(e.target.value as "OWNER" | "AGENT")}
              className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm"
            >
              <option value="AGENT">{t("assets.ownership.AGENT")}</option>
              <option value="OWNER">{t("assets.ownership.OWNER")}</option>
            </select>
          </label>
          {ownershipType === "AGENT" && (
            <label className="space-y-1 text-xs font-medium text-ink sm:col-span-2">
              <span>เจ้าของทรัพย์ *</span>
              <select
                required
                aria-label="เลือกเจ้าของทรัพย์"
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
                className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm"
              >
                <option value="">-- เลือกเจ้าของทรัพย์ --</option>
                {(ownersData?.items ?? []).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.code} — {o.fullName}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="space-y-1 text-xs font-medium text-ink">
            <span>เลขห้อง / บ้านเลขที่</span>
            <input
              aria-label="เลขห้องหรือบ้านเลขที่"
              value={unitNo}
              onChange={(e) => setUnitNo(e.target.value)}
              placeholder="เช่น 1205 หรือ 99/12"
              className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1 text-xs font-medium text-ink">
            <span>พื้นที่ใช้สอย (ตร.ม.)</span>
            <input
              type="number"
              step="0.01"
              aria-label="พื้นที่ใช้สอย"
              value={areaSqm}
              onChange={(e) => setAreaSqm(e.target.value)}
              className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1 text-xs font-medium text-ink">
            <span>ราคาเช่าต่อเดือน (บาท)</span>
            <input
              type="number"
              aria-label="ราคาเช่าต่อเดือน"
              value={rentPrice}
              onChange={(e) => setRentPrice(e.target.value)}
              className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1 text-xs font-medium text-ink">
            <span>ราคาเช่าต่ำสุดที่อนุมัติ (บาท)</span>
            <input
              type="number"
              aria-label="ราคาเช่าต่ำสุดที่อนุมัติ"
              value={minRentPrice}
              onChange={(e) => setMinRentPrice(e.target.value)}
              className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm"
            />
          </label>
        </div>
        <CategoryAttributesFields category={category} values={attributes} onChange={setAttributes} />
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-md border border-line px-4 py-2 text-xs text-ink">
            {t("archive.cancel")}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-brand px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
          >
            บันทึกทรัพย์สิน
          </button>
        </div>
      </form>
    </div>
  );
}
