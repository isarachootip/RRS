"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

interface BackofficeListingItem {
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

const STATUS_LABELS: Record<BackofficeListingItem["status"], string> = {
  DRAFT: "ฉบับร่าง",
  PENDING_APPROVAL: "รออนุมัติ",
  PUBLISHED: "เผยแพร่แล้ว",
  CLOSED: "ปิดประกาศ",
};

export function ListingsView() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [assetId, setAssetId] = useState("");
  const [type, setType] = useState<"RENT" | "SALE">("RENT");
  const [price, setPrice] = useState("25000");
  const [titleTh, setTitleTh] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const canApprove = Boolean(
    user?.roles.includes("ADMIN") || user?.roles.includes("MANAGER") || user?.permissions?.["listing.approve"],
  );
  const listingsQuery = useQuery({
    queryKey: ["listings", statusFilter],
    queryFn: () =>
      api<{ total: number; items: BackofficeListingItem[] }>(
        `/api/v1/listings${statusFilter ? `?status=${statusFilter}` : ""}`,
      ),
  });
  const assetsQuery = useQuery({
    queryKey: ["assets-for-listings"],
    queryFn: () => api<{ items: Array<{ id: string; code: string; category: string }> }>("/api/v1/assets?pageSize=50"),
  });
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
          submitForApproval: true,
        }),
      }),
    onSuccess: () => {
      setTitleTh("");
      setTitleEn("");
      qc.invalidateQueries({ queryKey: ["listings"] });
    },
  });
  const actionMut = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "submit" | "approve" | "close" }) =>
      api(`/api/v1/listings/${id}/${action}`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["listings"] }),
  });
  const items = listingsQuery.data?.items ?? [];
  const assets = assetsQuery.data?.items ?? [];

  return (
    <div className="space-y-6" data-testid="listings-view">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">ประกาศเว็บสาธารณะ (Public Portal Listings)</h1>
          <p className="text-sm text-slate-600">
            สร้างประกาศเช่า/ขาย ส่งให้ Manager อนุมัติ และปิดอัตโนมัติเมื่อห้องไม่ว่าง
          </p>
        </div>
        <select
          aria-label="กรองสถานะประกาศ"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">ทุกสถานะ</option>
          <option value="DRAFT">ฉบับร่าง</option>
          <option value="PENDING_APPROVAL">รออนุมัติ</option>
          <option value="PUBLISHED">เผยแพร่แล้ว</option>
          <option value="CLOSED">ปิดประกาศ</option>
        </select>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">สร้างประกาศใหม่และส่งขออนุมัติ</h2>
        <div className="grid gap-3 md:grid-cols-4">
          <select
            aria-label="เลือกทรัพย์สิน"
            value={assetId}
            onChange={(e) => setAssetId(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">-- เลือกทรัพย์สิน --</option>
            {assets.map((a) => (
              <option key={a.id} value={a.id}>{`${a.code} (${a.category})`}</option>
            ))}
          </select>
          <select
            aria-label="ประเภทประกาศ"
            value={type}
            onChange={(e) => setType(e.target.value as "RENT" | "SALE")}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="RENT">ให้เช่า (RENT)</option>
            <option value="SALE">ขาย (SALE)</option>
          </select>
          <input
            aria-label="ราคาประกาศ"
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="ราคาประกาศ (บาท)"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            aria-label="หัวข้อภาษาไทย"
            value={titleTh}
            onChange={(e) => setTitleTh(e.target.value)}
            placeholder="หัวข้อประกาศภาษาไทย"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-3">
          <input
            aria-label="หัวข้อภาษาอังกฤษ"
            value={titleEn}
            onChange={(e) => setTitleEn(e.target.value)}
            placeholder="Title (English)"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={!assetId || !titleTh.trim() || createMut.isPending}
            onClick={() => createMut.mutate()}
            className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
          >
            สร้างประกาศและส่งอนุมัติ
          </button>
        </div>
      </section>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-600">
            <tr>
              <th className="px-4 py-3">รหัสทรัพย์</th>
              <th className="px-4 py-3">หัวข้อประกาศ</th>
              <th className="px-4 py-3">ประเภท</th>
              <th className="px-4 py-3">ราคา</th>
              <th className="px-4 py-3">สถานะ</th>
              <th className="px-4 py-3">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3 font-mono text-xs">{item.asset.code}</td>
                <td className="px-4 py-3 font-medium text-slate-900">{item.titleTh}</td>
                <td className="px-4 py-3">{item.type === "RENT" ? "เช่า" : "ขาย"}</td>
                <td className="px-4 py-3">{Number(item.price).toLocaleString()} บาท</td>
                <td className="px-4 py-3">{STATUS_LABELS[item.status]}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {canApprove && item.status !== "PUBLISHED" && (
                      <button
                        type="button"
                        onClick={() => actionMut.mutate({ id: item.id, action: "approve" })}
                        className="rounded bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white"
                      >
                        อนุมัติเผยแพร่
                      </button>
                    )}
                    {item.status === "PUBLISHED" && (
                      <button
                        type="button"
                        onClick={() => actionMut.mutate({ id: item.id, action: "close" })}
                        className="rounded bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-800"
                      >
                        ปิดประกาศ
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
