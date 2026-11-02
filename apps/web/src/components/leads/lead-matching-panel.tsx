"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { t, type MessageKey } from "@/i18n/th";
import { api } from "@/lib/api";

export interface MatchedAssetItem {
  id: string;
  code: string;
  category: string;
  unitNo: string | null;
  rentPrice: string | null;
  salePrice: string | null;
  areaSqm: string | number | null;
  petAllowed: boolean;
  matchScore: number;
  matchedReasons: string[];
  hasViewingScheduled: boolean;
  project?: { id: string; name: string; district: string | null } | null;
  primaryAgent?: { id: string; fullName: string } | null;
}

interface MatchResponse {
  criteria: {
    intent: "RENT" | "BUY";
    location: string | null;
    budgetMin: number | null;
    budgetMax: number | null;
    category: string | null;
    minAreaSqm: number | null;
    petRequired: boolean;
  };
  items: MatchedAssetItem[];
}

export function LeadMatchingPanel({ leadId }: { leadId: string }) {
  const queryClient = useQueryClient();
  const [location, setLocation] = useState<string | undefined>(undefined);
  const [budgetMax, setBudgetMax] = useState<string | undefined>(undefined);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["lead-matches", leadId, location, budgetMax],
    queryFn: () => {
      const params = new URLSearchParams();
      if (location !== undefined) params.set("location", location);
      if (budgetMax !== undefined && budgetMax !== "") params.set("budgetMax", budgetMax);
      const qs = params.toString();
      return api<MatchResponse>(`/api/v1/leads/${leadId}/matches${qs ? `?${qs}` : ""}`);
    },
  });

  function toggleSelect(assetId: string) {
    setSelectedIds((prev) => (prev.includes(assetId) ? prev.filter((id) => id !== assetId) : [...prev, assetId]));
  }

  async function handleSaveOffers() {
    if (selectedIds.length === 0) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await api<{ shareToken: string }>(`/api/v1/leads/${leadId}/offers`, {
        method: "POST",
        body: JSON.stringify({
          items: selectedIds.map((assetId) => ({ assetId })),
        }),
      });
      setShareToken(res.shareToken);
      void queryClient.invalidateQueries({ queryKey: ["lead-offers", leadId] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกห้องที่เสนอไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  }

  const items = data?.items ?? [];

  return (
    <section className="space-y-4 rounded-lg border border-line bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">จับคู่ห้องว่างตามความต้องการลูกค้า</h2>
          <p className="text-xs text-ink-muted">แสดงเฉพาะห้องว่าง/มีนัดดู เรียงตามคะแนนความตรงเงื่อนไข</p>
        </div>
        <button
          type="button"
          disabled={selectedIds.length === 0 || submitting}
          onClick={() => void handleSaveOffers()}
          className="rounded bg-brand px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          บันทึกเป็นห้องที่เสนอ & สร้างลิงก์แชร์ ({selectedIds.length})
        </button>
      </div>

      {error && <p className="rounded bg-danger/10 p-3 text-xs text-danger">{error}</p>}

      {shareToken && (
        <div className="rounded border border-brand/30 bg-brand/5 p-3 text-xs text-ink">
          <span className="font-medium">สร้างลิงก์แชร์ให้ลูกค้าเรียบร้อย (หมดอายุใน 7 วัน): </span>
          <Link href={`/share/${shareToken}`} className="font-semibold text-brand underline">
            /share/{shareToken}
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input
          aria-label="กรองทำเลจับคู่"
          placeholder="ปรับทำเล/โครงการ..."
          value={location ?? data?.criteria.location ?? ""}
          onChange={(e) => setLocation(e.target.value)}
          className="rounded border border-line bg-surface px-3 py-1.5 text-xs text-ink"
        />
        <input
          type="number"
          aria-label="กรองงบสูงสุดจับคู่"
          placeholder="ปรับงบสูงสุด (บาท)..."
          value={budgetMax ?? (data?.criteria.budgetMax ? String(data.criteria.budgetMax) : "")}
          onChange={(e) => setBudgetMax(e.target.value)}
          className="rounded border border-line bg-surface px-3 py-1.5 text-xs text-ink"
        />
      </div>

      {isLoading ? (
        <p className="text-xs text-ink-muted">กำลังค้นหาห้องที่ตรงเงื่อนไข...</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-ink-muted">ไม่พบห้องว่างที่ตรงกับเงื่อนไข</p>
      ) : (
        <ul className="divide-y divide-line text-sm">
          {items.map((room) => (
            <li key={room.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <label className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  aria-label={`เลือกห้อง ${room.code}`}
                  checked={selectedIds.includes(room.id)}
                  onChange={() => toggleSelect(room.id)}
                  className="mt-1"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <Link href={`/assets/${room.id}`} className="font-medium text-brand hover:underline">
                      {room.code}
                    </Link>
                    <span className="text-xs text-ink-muted">
                      {t(`assets.cat.${room.category}` as MessageKey)} · ห้อง {room.unitNo ?? "-"} (
                      {room.project?.name ?? "-"})
                    </span>
                    <span className="rounded bg-surface-subtle px-2 py-0.5 text-xs font-medium text-ink">
                      {room.hasViewingScheduled ? "มีนัดดู" : "ว่าง"}
                    </span>
                  </div>
                  <p className="text-xs text-ink-muted">
                    ราคา: {room.rentPrice ?? room.salePrice ?? "-"} บาท · ผู้ดูแล: {room.primaryAgent?.fullName ?? "-"}{" "}
                    · ตรงเงื่อนไข: {room.matchedReasons.join(", ") || "-"}
                  </p>
                </div>
              </label>
              <span className="rounded-full bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand">
                {room.matchScore} คะแนน
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
