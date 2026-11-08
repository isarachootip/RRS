"use client";

import { useQuery } from "@tanstack/react-query";
import { ASSET_CATEGORIES, type AssetCategory, parseAssetAttributes } from "@rrs/shared";
import { useEffect, useState } from "react";
import { type MessageKey, t } from "@/i18n/th";
import { api, uploadEntityFile } from "@/lib/api";
import { AssetLocationMediaFields, type AssetLocationState } from "./asset-location-media-fields";
import {
  AssetUnitSpecFields,
  type AssetUnitSpecState,
  type EditableAsset,
  defaultUnitSpecsForCategory,
  hasUsableAreaField,
  initLoc,
  initSpec,
  isVerticalUnitCategory,
  unitNoLabelForCategory,
} from "./asset-unit-spec-fields";
import { CategoryAttributesFields, defaultAttributesForCategory } from "./category-attributes-fields";

export type { EditableAsset };

interface OwnerOption { id: string; code: string; fullName: string }

export function AssetFormModal({ initial, onClose, onSaved }: { initial?: EditableAsset | null; onClose: () => void; onSaved: () => void }) {
  const initCat = ((initial?.category as AssetCategory) ?? "CONDO") as AssetCategory;
  const [category, setCategory] = useState<AssetCategory>(initCat);
  const [ownershipType, setOwnershipType] = useState<"OWNER" | "AGENT">(initial?.ownershipType ?? "AGENT");
  const [ownerId, setOwnerId] = useState(initial?.ownerId ?? "");
  const [unitNo, setUnitNo] = useState(initial?.unitNo ?? "");
  const [areaSqm, setAreaSqm] = useState(initial?.areaSqm != null ? String(initial.areaSqm) : "35");
  const [rentPrice, setRentPrice] = useState(initial?.rentPrice != null ? String(initial.rentPrice) : "15000");
  const [minRentPrice, setMinRentPrice] = useState(initial?.minRentPrice != null ? String(initial.minRentPrice) : "14000");
  const [salePrice, setSalePrice] = useState(initial?.salePrice != null ? String(initial.salePrice) : "");
  const [loc, setLoc] = useState<AssetLocationState>(() => initLoc(initial));
  const [unitSpec, setUnitSpec] = useState<AssetUnitSpecState>(() => initSpec(initial, initCat));
  const [pendingPhotos, setPendingPhotos] = useState<File[]>([]);
  const [attributes, setAttributes] = useState<Record<string, unknown>>(
    () => (initial?.attributes as Record<string, unknown>) ?? defaultAttributesForCategory(initCat),
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: ownersData } = useQuery({
    queryKey: ["owners-options"],
    staleTime: 60_000,
    queryFn: () => api<{ items: OwnerOption[] }>("/api/v1/owners?pageSize=50"),
  });

  useEffect(() => {
    if (!initial?.id || initial.attributes !== undefined) return;
    void api<EditableAsset>(`/api/v1/assets/${initial.id}`)
      .then((full) => {
        if (!full?.id) return;
        setLoc(initLoc(full));
        setUnitSpec(initSpec(full, (full.category as AssetCategory) ?? initCat));
        if (full.attributes) setAttributes(full.attributes);
      })
      .catch(() => {});
  }, [initial?.id, initial?.attributes, initCat]);

  function handleCategoryChange(nextCat: AssetCategory) {
    setCategory(nextCat);
    setAttributes(defaultAttributesForCategory(nextCat));
    setUnitSpec(defaultUnitSpecsForCategory(nextCat));
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
      const isVertical = isVerticalUnitCategory(category);
      const payload = {
        category,
        ownershipType,
        ownerId: ownershipType === "AGENT" ? ownerId || undefined : undefined,
        projectId: loc.projectId || null,
        unitNo: unitNo.trim() || null,
        tower: isVertical ? loc.tower.trim() || null : null,
        floor: isVertical && loc.floor !== "" ? Number(loc.floor) : null,
        address: loc.address.trim() || null,
        district: loc.district.trim() || null,
        province: loc.province.trim() || null,
        latitude: loc.latitude !== "" ? Number(loc.latitude) : null,
        longitude: loc.longitude !== "" ? Number(loc.longitude) : null,
        areaSqm: hasUsableAreaField(category) && areaSqm ? Number(areaSqm) : null,
        roomType: isVertical && unitSpec.roomType ? unitSpec.roomType : null,
        bedrooms: unitSpec.bedrooms !== "" ? Number(unitSpec.bedrooms) : null,
        bathrooms: unitSpec.bathrooms !== "" ? Number(unitSpec.bathrooms) : null,
        furniture: unitSpec.furniture.trim() || null,
        petAllowed: unitSpec.petAllowed,
        rentPrice: rentPrice ? Number(rentPrice) : null,
        minRentPrice: minRentPrice ? Number(minRentPrice) : null,
        salePrice: salePrice ? Number(salePrice) : null,
        forSale: Boolean(salePrice && Number(salePrice) > 0),
        attributes: parsedAttrs,
      };
      const saved = initial?.id
        ? await api<{ id?: string }>(`/api/v1/assets/${initial.id}`, { method: "PATCH", body: JSON.stringify(payload) })
        : await api<{ id?: string }>("/api/v1/assets", { method: "POST", body: JSON.stringify(payload) });

      const targetAssetId = initial?.id ?? saved?.id;
      if (targetAssetId && pendingPhotos.length > 0) {
        for (let i = 0; i < pendingPhotos.length; i += 1) {
          const photo = pendingPhotos[i];
          if (!photo) continue;
          const uploaded = await uploadEntityFile(photo, "asset", targetAssetId);
          await api(`/api/v1/assets/${targetAssetId}/media`, {
            method: "POST",
            body: JSON.stringify({ fileId: uploaded.id, isCover: i === 0 && !initial?.id }),
          });
        }
      }
      onSaved();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "บันทึกทรัพย์สินไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "w-full rounded-md border border-line bg-surface px-3 py-2 text-sm";
  const unitMeta = unitNoLabelForCategory(category);
  const showArea = hasUsableAreaField(category);

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={handleSubmit} className="max-h-[90vh] w-full max-w-3xl space-y-4 overflow-y-auto rounded-lg border border-line bg-surface p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-ink">{initial?.id ? `แก้ไขทรัพย์สิน (${initial.code ?? ""})` : t("assets.add")}</h2>
        {errorMsg && <p className="rounded bg-danger/10 p-2 text-xs text-danger">{errorMsg}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-xs font-medium text-ink">
            <span>ประเภทสินทรัพย์ *</span>
            <select aria-label="ประเภทสินทรัพย์" value={category} onChange={(e) => handleCategoryChange(e.target.value as AssetCategory)} className={inputCls}>
              {ASSET_CATEGORIES.map((c) => <option key={c} value={c}>{t(`assets.cat.${c}` as MessageKey)}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium text-ink">
            <span>รูปแบบความเป็นเจ้าของ *</span>
            <select aria-label="รูปแบบความเป็นเจ้าของ" value={ownershipType} onChange={(e) => setOwnershipType(e.target.value as "OWNER" | "AGENT")} className={inputCls}>
              <option value="AGENT">{t("assets.ownership.AGENT")}</option>
              <option value="OWNER">{t("assets.ownership.OWNER")}</option>
            </select>
          </label>
          {ownershipType === "AGENT" && !initial?.id && (
            <label className="space-y-1 text-xs font-medium text-ink sm:col-span-2">
              <span>เจ้าของทรัพย์ *</span>
              <select required aria-label="เลือกเจ้าของทรัพย์" value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className={inputCls}>
                <option value="">-- เลือกเจ้าของทรัพย์ --</option>
                {(ownersData?.items ?? []).map((o) => <option key={o.id} value={o.id}>{o.code} — {o.fullName}</option>)}
              </select>
            </label>
          )}
          <label className={`space-y-1 text-xs font-medium text-ink ${showArea ? "" : "sm:col-span-2"}`}>
            <span>{unitMeta.label}</span>
            <input aria-label="เลขห้องหรือบ้านเลขที่" value={unitNo} onChange={(e) => setUnitNo(e.target.value)} placeholder={unitMeta.placeholder} className={inputCls} />
          </label>
          {showArea && (
            <label className="space-y-1 text-xs font-medium text-ink">
              <span>พื้นที่ใช้สอยรวม (ตร.ม.)</span>
              <input type="number" step="0.01" aria-label="พื้นที่ใช้สอย" value={areaSqm} onChange={(e) => setAreaSqm(e.target.value)} className={inputCls} />
            </label>
          )}
          <label className="space-y-1 text-xs font-medium text-ink"><span>ราคาเช่าต่อเดือน (บาท)</span><input type="number" aria-label="ราคาเช่าต่อเดือน" value={rentPrice} onChange={(e) => setRentPrice(e.target.value)} className={inputCls} /></label>
          <label className="space-y-1 text-xs font-medium text-ink"><span>ราคาเช่าต่ำสุดที่อนุมัติ (บาท)</span><input type="number" aria-label="ราคาเช่าต่ำสุดที่อนุมัติ" value={minRentPrice} onChange={(e) => setMinRentPrice(e.target.value)} className={inputCls} /></label>
          <label className="space-y-1 text-xs font-medium text-ink sm:col-span-2"><span>ราคาขาย (บาท) — เว้นว่างหากปล่อยเช่าอย่างเดียว</span><input type="number" aria-label="ราคาขาย" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} placeholder="เช่น 3500000" className={inputCls} /></label>
        </div>
        <AssetUnitSpecFields category={category} spec={unitSpec} onChange={(patch) => setUnitSpec((prev) => ({ ...prev, ...patch }))} />
        <CategoryAttributesFields category={category} values={attributes} onChange={setAttributes} />
        <AssetLocationMediaFields category={category} loc={loc} onChange={(patch) => setLoc((prev) => ({ ...prev, ...patch }))} pendingPhotos={pendingPhotos} onPendingPhotosChange={setPendingPhotos} />
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-md border border-line px-4 py-2 text-xs text-ink">{t("archive.cancel")}</button>
          <button type="submit" disabled={saving} className="rounded-md bg-brand px-4 py-2 text-xs font-medium text-white disabled:opacity-50">บันทึกทรัพย์สิน</button>
        </div>
      </form>
    </div>
  );
}
