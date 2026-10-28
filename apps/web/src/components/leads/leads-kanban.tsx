"use client";

import Link from "next/link";
import { useState } from "react";
import { t, type MessageKey } from "@/i18n/th";
import { api } from "@/lib/api";

export interface LeadItem {
  id: string;
  code: string;
  intent: "RENT" | "BUY";
  fullName: string;
  phone: string | null;
  status: string;
  budgetMin: string | number | null;
  budgetMax: string | number | null;
  preferredLocation: string | null;
  ownerAgentId: string;
  ownerAgent?: { id: string; fullName: string };
}

export const PIPELINE_STATUSES = [
  "NEW",
  "CONTACTED",
  "VIEWING_SCHEDULED",
  "VIEWED",
  "BOOKED",
  "CONTRACTED",
  "LOST",
  "CANCELLED",
  "UNDECIDED",
] as const;

const PIPELINE_RANK: Record<string, number> = {
  NEW: 0,
  CONTACTED: 1,
  VIEWING_SCHEDULED: 2,
  VIEWED: 3,
  BOOKED: 4,
  CONTRACTED: 5,
};

const OFF_TRACK = new Set(["LOST", "CANCELLED", "UNDECIDED"]);

export function requiresStatusReason(currentStatus: string, nextStatus: string): boolean {
  if (OFF_TRACK.has(nextStatus)) return true;
  const curRank = PIPELINE_RANK[currentStatus];
  const nextRank = PIPELINE_RANK[nextStatus];
  return curRank !== undefined && nextRank !== undefined && nextRank < curRank;
}

interface LeadsKanbanProps {
  items: LeadItem[];
  onChanged: () => void;
}

export function LeadsKanban({ items, onChanged }: LeadsKanbanProps) {
  const [pendingChange, setPendingChange] = useState<{
    leadId: string;
    leadName: string;
    nextStatus: string;
  } | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function applyStatusChange(leadId: string, status: string, reasonText?: string) {
    setError(null);
    try {
      await api(`/api/v1/leads/${leadId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status, reason: reasonText || null }),
      });
      setPendingChange(null);
      setReason("");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เปลี่ยนสถานะไม่สำเร็จ");
    }
  }

  function handleSelectStatus(lead: LeadItem, nextStatus: string) {
    if (nextStatus === lead.status) return;
    if (requiresStatusReason(lead.status, nextStatus)) {
      setPendingChange({ leadId: lead.id, leadName: lead.fullName, nextStatus });
      setReason("");
      return;
    }
    void applyStatusChange(lead.id, nextStatus);
  }

  return (
    <div className="space-y-4">
      {error && <p className="rounded bg-danger/10 p-3 text-sm text-danger">{error}</p>}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {PIPELINE_STATUSES.map((status) => {
          const group = items.filter((l) => l.status === status);
          return (
            <div key={status} className="rounded-lg border border-line bg-surface-subtle p-3">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-semibold text-ink">{t(`leads.status.${status}` as MessageKey)}</h3>
                <span className="rounded-full bg-surface px-2 py-0.5 text-xs text-ink-muted">{group.length}</span>
              </div>
              <div className="space-y-2">
                {group.map((lead) => (
                  <div key={lead.id} className="space-y-2 rounded border border-line bg-surface p-3 shadow-sm">
                    <div className="flex items-center justify-between text-xs text-ink-muted">
                      <span>{lead.code}</span>
                      <span>{t(`leads.intent.${lead.intent}` as MessageKey)}</span>
                    </div>
                    <Link href={`/leads/${lead.id}`} className="block text-sm font-medium text-brand hover:underline">
                      {lead.fullName}
                    </Link>
                    <p className="text-xs text-ink-muted">ผู้ดูแล: {lead.ownerAgent?.fullName ?? "-"}</p>
                    <select
                      aria-label={`เปลี่ยนสถานะ ${lead.fullName}`}
                      value={lead.status}
                      onChange={(e) => handleSelectStatus(lead, e.target.value)}
                      className="w-full rounded border border-line bg-surface px-2 py-1 text-xs text-ink"
                    >
                      {PIPELINE_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {t(`leads.status.${s}` as MessageKey)}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {pendingChange && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="ระบุเหตุผลการเปลี่ยนสถานะ"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void applyStatusChange(pendingChange.leadId, pendingChange.nextStatus, reason);
            }}
            className="w-full max-w-md space-y-3 rounded-lg border border-line bg-surface p-5 shadow-xl"
          >
            <h3 className="text-base font-semibold text-ink">ระบุเหตุผลการเปลี่ยนสถานะ ({pendingChange.leadName})</h3>
            <textarea
              required
              aria-label="เหตุผลการเปลี่ยนสถานะ"
              placeholder="กรุณาระบุเหตุผล เช่น ลูกค้าได้ห้องอื่นแล้ว หรือชะลอการย้าย..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded border border-line bg-surface p-2 text-sm text-ink"
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingChange(null)}
                className="rounded border border-line px-3 py-1.5 text-xs text-ink"
              >
                ยกเลิก
              </button>
              <button type="submit" className="rounded bg-brand px-3 py-1.5 text-xs font-medium text-white">
                ยืนยันเปลี่ยนสถานะ
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
