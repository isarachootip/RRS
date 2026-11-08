"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type AssetSpecSummaryInput, buildCategoryHighlights, generateListingDraft } from "@rrs/shared";
import { useState } from "react";
import { ConfirmArchiveDialog } from "@/components/confirm-archive-dialog";
import { type MessageKey, t } from "@/i18n/th";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { type EditableListingItem, ListingEditModal } from "./listing-edit-modal";

const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL ?? "https://portalrrs.tamadee.online";
const STATUS_LABELS: Record<EditableListingItem["status"], string> = {
  DRAFT: "ฉบับร่าง",
  PENDING_APPROVAL: "รออนุมัติ",
  PUBLISHED: "เผยแพร่แล้ว",
  CLOSED: "ปิดประกาศ",
};

type AssetOption = AssetSpecSummaryInput & { id: string; code: string; category: string };

export function ListingsView() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [archived, setArchived] = useState<"false" | "true">("false");
  const [assetId, setAssetId] = useState("");
  const [type, setType] = useState<"RENT" | "SALE">("RENT");
  const [price, setPrice] = useState("25000");
  const [titleTh, setTitleTh] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [descriptionTh, setDescriptionTh] = useState("");
  const [descriptionEn, setDescriptionEn] = useState("");
  const [editingListing, setEditingListing] = useState<EditableListingItem | null>(null);

  const canApprove = Boolean(
    user?.roles.includes("ADMIN") || user?.roles.includes("MANAGER") || user?.permissions?.["listing.approve"],
  );

  const listingsQuery = useQuery({
    queryKey: ["listings", statusFilter, archived],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (statusFilter) qs.set("status", statusFilter);
      if (archived === "true") qs.set("archived", "true");
      return api<{ total: number; items: EditableListingItem[] }>(`/api/v1/listings?${qs.toString()}`);
    },
  });

  const assetsQuery = useQuery({
    queryKey: ["assets-for-listings"],
    queryFn: () => api<{ items: AssetOption[] }>("/api/v1/assets?pageSize=50"),
  });

  const refresh = () => void qc.invalidateQueries({ queryKey: ["listings"] });
  const assets = assetsQuery.data?.items ?? [];
  const selectedAsset = assets.find((a) => a.id === assetId) ?? null;
  const selectedHighlights = selectedAsset ? buildCategoryHighlights(selectedAsset, "th") : [];

  function applyDraft(targetAsset: AssetOption | null, txType: "RENT" | "SALE") {
    if (!targetAsset) return;
    const draft = generateListingDraft(targetAsset, txType);
    setPrice(String(draft.suggestedPrice));
    setTitleTh(draft.titleTh);
    setTitleEn(draft.titleEn);
    setDescriptionTh(draft.descriptionTh);
    setDescriptionEn(draft.descriptionEn);
  }

  const createMut = useMutation({
    mutationFn: () =>
      api("/api/v1/listings", {
        method: "POST",
        body: JSON.stringify({
          assetId,
          type,
          price: Number(price),
          titleTh,
          titleEn: titleEn || null,
          descriptionTh: descriptionTh || null,
          descriptionEn: descriptionEn || null,
          submitForApproval: true,
        }),
      }),
    onSuccess: () => {
      setTitleTh("");
      setTitleEn("");
      setDescriptionTh("");
      setDescriptionEn("");
      refresh();
    },
  });

  const actionMut = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "submit" | "approve" | "close" }) =>
      api(`/api/v1/listings/${id}/${action}`, { method: "POST" }),
    onSuccess: refresh,
  });

  const items = listingsQuery.data?.items ?? [];
  const inputCls = "rounded-lg border border-slate-300 px-3 py-2 text-sm";

  return (
    <div className="space-y-6" data-testid="listings-view">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">ประกาศเว็บสาธารณะ (Public Portal Listings)</h1>
          <p className="text-sm text-slate-600">สร้างประกาศเช่า/ขายพร้อมสเปกเฉพาะประเภท ส่งให้ Manager อนุมัติ และแสดงผลบนเว็บ</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href={`${PORTAL_URL}/th`} target="_blank" rel="noreferrer" className="rounded-lg border border-teal-700 bg-teal-50 px-3 py-2 text-sm font-medium text-teal-800 hover:bg-teal-100">
            🌐 เปิดเว็บหน้าบ้าน (portalrrs.tamadee.online)
          </a>
          <select aria-label="กรองสถานะประกาศ" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={`${inputCls} bg-white`}>
            <option value="">ทุกสถานะ</option>
            <option value="DRAFT">ฉบับร่าง</option>
            <option value="PENDING_APPROVAL">รออนุมัติ</option>
            <option value="PUBLISHED">เผยแพร่แล้ว</option>
            <option value="CLOSED">ปิดประกาศ</option>
          </select>
          <select aria-label="กรองประกาศเก็บเข้ากรุ" value={archived} onChange={(e) => setArchived(e.target.value as "false" | "true")} className={`${inputCls} bg-white`}>
            <option value="false">รายการปกติ</option>
            <option value="true">เก็บเข้ากรุแล้ว (Archived)</option>
          </select>
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-800">สร้างประกาศใหม่และส่งขออนุมัติ (เติมหัวข้อและสเปกอัตโนมัติตามประเภททรัพย์)</h2>
          {selectedAsset && (
            <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-800">
              สเปกที่จะขึ้นเว็บ: {selectedHighlights.join(" · ") || t(`assets.cat.${selectedAsset.category}` as MessageKey)}
            </span>
          )}
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <select aria-label="เลือกทรัพย์สิน" value={assetId} onChange={(e) => { setAssetId(e.target.value); applyDraft(assets.find((a) => a.id === e.target.value) ?? null, type); }} className={inputCls}>
            <option value="">-- เลือกทรัพย์สิน --</option>
            {assets.map((a) => <option key={a.id} value={a.id}>{`${a.code} (${t(`assets.cat.${a.category}` as MessageKey)})`}</option>)}
          </select>
          <select aria-label="ประเภทประกาศ" value={type} onChange={(e) => { const next = e.target.value as "RENT" | "SALE"; setType(next); applyDraft(selectedAsset, next); }} className={inputCls}>
            <option value="RENT">ให้เช่า (RENT)</option>
            <option value="SALE">ขาย (SALE)</option>
          </select>
          <input aria-label="ราคาประกาศ" type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="ราคาประกาศ (บาท)" className={inputCls} />
          <input aria-label="หัวข้อภาษาไทย" value={titleTh} onChange={(e) => setTitleTh(e.target.value)} placeholder="หัวข้อประกาศภาษาไทย" className={inputCls} />
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <input aria-label="หัวข้อภาษาอังกฤษ" value={titleEn} onChange={(e) => setTitleEn(e.target.value)} placeholder="Title (English)" className={inputCls} />
          <input aria-label="รายละเอียดภาษาไทย" value={descriptionTh} onChange={(e) => setDescriptionTh(e.target.value)} placeholder="รายละเอียด/จุดเด่นภาษาไทย" className={inputCls} />
          <div className="flex gap-2">
            <input aria-label="รายละเอียดภาษาอังกฤษ" value={descriptionEn} onChange={(e) => setDescriptionEn(e.target.value)} placeholder="Description (English)" className={`flex-1 ${inputCls}`} />
            <button type="button" disabled={!assetId || !titleTh.trim() || createMut.isPending} onClick={() => createMut.mutate()} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
              สร้างประกาศและส่งอนุมัติ
            </button>
          </div>
        </div>
      </section>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-600">
            <tr>
              <th className="px-4 py-3">รหัส / ประเภท</th>
              <th className="px-4 py-3">หัวข้อและจุดเด่นบนเว็บ</th>
              <th className="px-4 py-3">ธุรกรรม</th>
              <th className="px-4 py-3">ราคา</th>
              <th className="px-4 py-3">สถานะ</th>
              <th className="px-4 py-3">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item) => {
              const badges = buildCategoryHighlights(item.asset, "th");
              return (
                <tr key={item.id}>
                  <td className="px-4 py-3"><div className="font-mono text-xs font-semibold">{item.asset.code}</div><div className="text-xs text-slate-500">{t(`assets.cat.${item.asset.category}` as MessageKey)}</div></td>
                  <td className="px-4 py-3"><div className="font-medium text-slate-900">{item.titleTh}</div>{badges.length > 0 && <div className="mt-0.5 text-xs text-teal-700">{badges.join(" · ")}</div>}</td>
                  <td className="px-4 py-3">{item.type === "RENT" ? "เช่า" : "ขาย"}</td>
                  <td className="px-4 py-3">{Number(item.price).toLocaleString()} บาท</td>
                  <td className="px-4 py-3">{STATUS_LABELS[item.status]}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" onClick={() => setEditingListing(item)} className="rounded border border-brand/40 bg-lagoon-soft/50 px-2.5 py-1 text-xs font-medium text-brand hover:bg-lagoon-soft">แก้ไข</button>
                      {canApprove && item.status !== "PUBLISHED" && <button type="button" onClick={() => actionMut.mutate({ id: item.id, action: "approve" })} className="rounded bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white">อนุมัติเผยแพร่</button>}
                      {item.status === "PUBLISHED" && (
                        <>
                          <a href={`${PORTAL_URL}/th/listings/${item.slug}`} target="_blank" rel="noreferrer" className="rounded bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-800 hover:bg-teal-100">ดูโพสต์บนเว็บ ↗</a>
                          <button type="button" onClick={() => actionMut.mutate({ id: item.id, action: "close" })} className="rounded bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-800">ปิดประกาศ</button>
                        </>
                      )}
                      {archived === "false" && <ConfirmArchiveDialog itemLabel={`${item.asset.code} ${item.titleTh}`} buttonLabel="ลบ/เก็บเข้ากรุ" onConfirm={async () => { await api(`/api/v1/listings/${item.id}/archive`, { method: "POST" }); refresh(); }} />}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editingListing && <ListingEditModal initial={editingListing} onClose={() => setEditingListing(null)} onSaved={refresh} />}
    </div>
  );
}
