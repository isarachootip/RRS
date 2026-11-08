"use client";

import { type AssetSpecSummaryInput, buildCategoryHighlights, generateListingDraft } from "@rrs/shared";
import { useState } from "react";
import { type MessageKey, t } from "@/i18n/th";
import { api } from "@/lib/api";

export interface EditableListingItem {
  id: string;
  slug: string;
  type: "RENT" | "SALE";
  status: "DRAFT" | "PENDING_APPROVAL" | "PUBLISHED" | "CLOSED";
  titleTh: string;
  titleEn: string | null;
  descriptionTh?: string | null;
  descriptionEn?: string | null;
  price: string | number;
  viewCount: number;
  asset: AssetSpecSummaryInput & { id: string; code: string; category: string; status: string };
}

interface ListingEditModalProps {
  initial: EditableListingItem;
  onClose: () => void;
  onSaved: () => void;
}

export function ListingEditModal({ initial, onClose, onSaved }: ListingEditModalProps) {
  const [titleTh, setTitleTh] = useState(initial.titleTh);
  const [titleEn, setTitleEn] = useState(initial.titleEn ?? "");
  const [descriptionTh, setDescriptionTh] = useState(initial.descriptionTh ?? "");
  const [descriptionEn, setDescriptionEn] = useState(initial.descriptionEn ?? "");
  const [price, setPrice] = useState(String(initial.price));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const highlights = buildCategoryHighlights(initial.asset, "th");

  function handleAutoFill() {
    const draft = generateListingDraft(initial.asset, initial.type);
    setTitleTh(draft.titleTh);
    setTitleEn(draft.titleEn);
    setDescriptionTh(draft.descriptionTh);
    setDescriptionEn(draft.descriptionEn);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api(`/api/v1/listings/${initial.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          titleTh: titleTh.trim(),
          titleEn: titleEn.trim() || null,
          descriptionTh: descriptionTh.trim() || null,
          descriptionEn: descriptionEn.trim() || null,
          price: Number(price),
        }),
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "แก้ไขประกาศไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink";

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form
        onSubmit={handleSubmit}
        className="max-h-[90vh] w-full max-w-xl space-y-4 overflow-y-auto rounded-xl border border-line bg-surface p-6 shadow-xl"
      >
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-ink">
              แก้ไขประกาศ ({initial.asset.code} · {t(`assets.cat.${initial.asset.category}` as MessageKey)})
            </h2>
            {highlights.length > 0 && (
              <p className="mt-0.5 text-xs text-ink-muted">จุดเด่นบนเว็บ: {highlights.join(" · ")}</p>
            )}
          </div>
          <button
            type="button"
            onClick={handleAutoFill}
            className="rounded border border-brand/40 bg-lagoon-soft/50 px-2.5 py-1 text-xs font-medium text-brand hover:bg-lagoon-soft"
          >
            ✨ สร้างคำโปรยอัตโนมัติ
          </button>
        </div>
        {error && <p className="rounded bg-danger/10 p-2 text-xs text-danger">{error}</p>}
        <label className="block space-y-1 text-xs font-medium text-ink">
          <span>หัวข้อประกาศภาษาไทย *</span>
          <input required aria-label="แก้ไขหัวข้อภาษาไทย" value={titleTh} onChange={(e) => setTitleTh(e.target.value)} className={inputCls} />
        </label>
        <label className="block space-y-1 text-xs font-medium text-ink">
          <span>หัวข้อภาษาอังกฤษ (Title English)</span>
          <input aria-label="แก้ไขหัวข้อภาษาอังกฤษ" value={titleEn} onChange={(e) => setTitleEn(e.target.value)} className={inputCls} />
        </label>
        <label className="block space-y-1 text-xs font-medium text-ink">
          <span>รายละเอียดประกาศภาษาไทย (Description TH)</span>
          <textarea rows={2} aria-label="แก้ไขรายละเอียดภาษาไทย" value={descriptionTh} onChange={(e) => setDescriptionTh(e.target.value)} className={inputCls} />
        </label>
        <label className="block space-y-1 text-xs font-medium text-ink">
          <span>รายละเอียดภาษาอังกฤษ (Description EN)</span>
          <textarea rows={2} aria-label="แก้ไขรายละเอียดภาษาอังกฤษ" value={descriptionEn} onChange={(e) => setDescriptionEn(e.target.value)} className={inputCls} />
        </label>
        <label className="block space-y-1 text-xs font-medium text-ink">
          <span>ราคาประกาศ (บาท) *</span>
          <input required type="number" aria-label="แก้ไขราคาประกาศ" value={price} onChange={(e) => setPrice(e.target.value)} className={inputCls} />
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-md border border-line px-4 py-2 text-xs text-ink">
            ยกเลิก
          </button>
          <button type="submit" disabled={saving} className="rounded-md bg-brand px-4 py-2 text-xs font-medium text-white disabled:opacity-50">
            บันทึกการแก้ไข
          </button>
        </div>
      </form>
    </div>
  );
}
