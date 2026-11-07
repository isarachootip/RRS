"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { t } from "@/i18n/th";
import { api, uploadEntityFile } from "@/lib/api";

export interface AssetMediaItem {
  id: string;
  fileId: string;
  sortOrder: number;
  caption: string | null;
  isCover: boolean;
  file?: { id: string; originalName: string };
}

export interface AssetAgentItem {
  userId: string;
  role: "LISTING" | "CO_AGENT";
  user?: { id: string; fullName: string };
}

export interface ListingAgreementItem {
  id: string;
  transactionType: "RENT" | "SALE";
  startDate: string;
  endDate: string | null;
  commissionFormula: string;
  exclusive: boolean;
  status: string;
}

interface AssetRelationsPanelProps {
  assetId: string;
  media: AssetMediaItem[];
  agents: AssetAgentItem[];
  agreements: ListingAgreementItem[];
}

export function AssetRelationsPanel({ assetId, media, agents, agreements }: AssetRelationsPanelProps) {
  const queryClient = useQueryClient();
  const [startDate, setStartDate] = useState("2026-10-01");
  const [endDate, setEndDate] = useState("2027-09-30");
  const [formula, setFormula] = useState("ONE_MONTH");
  const [uploadingMedia, setUploadingMedia] = useState(false);

  async function handleUploadPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setUploadingMedia(true);
    try {
      for (let i = 0; i < files.length; i += 1) {
        const f = files[i];
        if (!f) continue;
        const uploaded = await uploadEntityFile(f, "asset", assetId);
        await api(`/api/v1/assets/${assetId}/media`, {
          method: "POST",
          body: JSON.stringify({ fileId: uploaded.id, isCover: media.length === 0 && i === 0 }),
        });
      }
      await queryClient.invalidateQueries({ queryKey: ["asset", assetId] });
    } finally {
      setUploadingMedia(false);
      e.target.value = "";
    }
  }

  async function moveMedia(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= media.length) return;
    const next = [...media];
    const [moved] = next.splice(index, 1);
    if (!moved) return;
    next.splice(target, 0, moved);

    await api(`/api/v1/assets/${assetId}/media/reorder`, {
      method: "PUT",
      body: JSON.stringify({ orderedIds: next.map((m) => m.id) }),
    });
    await queryClient.invalidateQueries({ queryKey: ["asset", assetId] });
  }

  async function removeMedia(mediaId: string) {
    await api(`/api/v1/assets/${assetId}/media/${mediaId}`, { method: "DELETE" });
    await queryClient.invalidateQueries({ queryKey: ["asset", assetId] });
  }

  async function handleAddAgreement(e: React.FormEvent) {
    e.preventDefault();
    await api(`/api/v1/assets/${assetId}/agreements`, {
      method: "POST",
      body: JSON.stringify({
        transactionType: "RENT",
        startDate,
        endDate: endDate || null,
        commissionFormula: formula,
        exclusive: true,
      }),
    });
    await queryClient.invalidateQueries({ queryKey: ["asset", assetId] });
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section className="space-y-3 rounded-lg border border-line bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-ink">{t("assets.media.title")}</h2>
          <label className="cursor-pointer rounded bg-brand px-3 py-1.5 text-xs font-medium text-white hover:opacity-90">
            {uploadingMedia ? "กำลังอัปโหลด..." : "+ อัปโหลดรูปห้อง/สถานที่เพิ่ม"}
            <input type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={uploadingMedia} onChange={(e) => void handleUploadPhotos(e)} className="hidden" />
          </label>
        </div>
        {media.length === 0 ? (
          <p className="text-xs text-ink-muted">ยังไม่มีรูปภาพในแกลเลอรี</p>
        ) : (
          <ul className="space-y-2">
            {media.map((m, idx) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-2 rounded border border-line bg-surface-subtle px-3 py-2 text-xs"
              >
                <div className="flex items-center gap-2.5 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/v1/files/${m.fileId}/raw`}
                    alt={m.file?.originalName ?? "รูปทรัพย์สิน"}
                    className="h-12 w-16 shrink-0 rounded border border-line object-cover"
                  />
                  <div className="truncate">
                    <a
                      href={`/api/v1/files/${m.fileId}/raw`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-brand hover:underline"
                    >
                      #{idx + 1} {m.file?.originalName ?? m.fileId}
                    </a>
                    {m.isCover && <span className="ml-1.5 rounded bg-brand/15 px-1.5 py-0.5 text-[10px] font-semibold text-brand">(รูปปก)</span>}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button type="button" onClick={() => void moveMedia(idx, -1)} className="rounded border border-line bg-surface px-2 py-0.5">↑</button>
                  <button type="button" onClick={() => void moveMedia(idx, 1)} className="rounded border border-line bg-surface px-2 py-0.5">↓</button>
                  <button type="button" onClick={() => void removeMedia(m.id)} className="rounded border border-danger/30 bg-danger/10 px-2 py-0.5 text-danger">ลบ</button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <h3 className="pt-2 text-sm font-semibold text-ink">{t("assets.agents.title")}</h3>
        <ul className="space-y-1 text-xs text-ink-muted">
          {agents.map((a) => (
            <li key={a.userId}>
              {a.user?.fullName ?? a.userId} — <span className="font-semibold text-ink">{a.role}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3 rounded-lg border border-line bg-surface p-5">
        <h2 className="text-base font-semibold text-ink">{t("assets.agreements.title")}</h2>
        <form onSubmit={handleAddAgreement} className="grid gap-2 sm:grid-cols-3">
          <input type="date" aria-label="วันเริ่มสัญญาฝาก" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded border border-line bg-surface px-2 py-1 text-xs" />
          <input type="date" aria-label="วันสิ้นสุดสัญญาฝาก" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="rounded border border-line bg-surface px-2 py-1 text-xs" />
          <select aria-label="สูตรค่านายหน้าเริ่มต้น" value={formula} onChange={(e) => setFormula(e.target.value)} className="rounded border border-line bg-surface px-2 py-1 text-xs">
            <option value="ONE_MONTH">1 เดือน (ONE_MONTH)</option>
            <option value="PERCENT_TOTAL">% ค่าเช่ารวม</option>
            <option value="N_MONTHS">N เดือน</option>
            <option value="FIXED">ยอดคงที่</option>
          </select>
          <button type="submit" className="rounded bg-brand px-3 py-1.5 text-xs font-medium text-white sm:col-span-3">
            บันทึกสัญญาฝากเช่า/ขายใหม่
          </button>
        </form>

        <ul className="space-y-2 pt-2 text-xs">
          {agreements.map((ag) => (
            <li key={ag.id} className="rounded border border-line bg-surface-subtle p-2">
              <span className="font-semibold text-ink">{ag.transactionType}</span> · สูตร {ag.commissionFormula} (
              {ag.startDate.slice(0, 10)} → {ag.endDate ? ag.endDate.slice(0, 10) : "-"})
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
