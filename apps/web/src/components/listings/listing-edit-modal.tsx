"use client";

import { useState } from "react";
import { api } from "@/lib/api";

export interface EditableListingItem {
  id: string;
  slug: string;
  type: "RENT" | "SALE";
  status: "DRAFT" | "PENDING_APPROVAL" | "PUBLISHED" | "CLOSED";
  titleTh: string;
  titleEn: string | null;
  price: string | number;
  viewCount: number;
  asset: { id: string; code: string; category: string; status: string };
}

interface ListingEditModalProps {
  initial: EditableListingItem;
  onClose: () => void;
  onSaved: () => void;
}

export function ListingEditModal({ initial, onClose, onSaved }: ListingEditModalProps) {
  const [titleTh, setTitleTh] = useState(initial.titleTh);
  const [titleEn, setTitleEn] = useState(initial.titleEn ?? "");
  const [price, setPrice] = useState(String(initial.price));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg space-y-4 rounded-xl border border-line bg-surface p-6 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">แก้ไขประกาศ ({initial.asset.code})</h2>
          <button type="button" onClick={onClose} className="text-xs text-ink-muted">
            ปิด
          </button>
        </div>
        {error && <p className="rounded bg-danger/10 p-2 text-xs text-danger">{error}</p>}
        <label className="block space-y-1 text-xs font-medium text-ink">
          <span>หัวข้อประกาศภาษาไทย *</span>
          <input
            required
            aria-label="แก้ไขหัวข้อภาษาไทย"
            value={titleTh}
            onChange={(e) => setTitleTh(e.target.value)}
            className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm"
          />
        </label>
        <label className="block space-y-1 text-xs font-medium text-ink">
          <span>หัวข้อภาษาอังกฤษ (Title English)</span>
          <input
            aria-label="แก้ไขหัวข้อภาษาอังกฤษ"
            value={titleEn}
            onChange={(e) => setTitleEn(e.target.value)}
            className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm"
          />
        </label>
        <label className="block space-y-1 text-xs font-medium text-ink">
          <span>ราคาประกาศ (บาท) *</span>
          <input
            required
            type="number"
            aria-label="แก้ไขราคาประกาศ"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm"
          />
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-md border border-line px-4 py-2 text-xs text-ink">
            ยกเลิก
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-brand px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
          >
            บันทึกการแก้ไข
          </button>
        </div>
      </form>
    </div>
  );
}
