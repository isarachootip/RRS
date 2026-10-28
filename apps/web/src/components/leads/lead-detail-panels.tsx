"use client";

import { useState } from "react";
import { t } from "@/i18n/th";
import { api } from "@/lib/api";

export interface LeadActivityItem {
  id: string;
  type: string;
  summary: string;
  createdAt: string;
  user?: { id: string; fullName: string };
}

export interface LeadAssignmentItem {
  id: string;
  toUserId: string;
  reason: string | null;
  toUser?: { id: string; fullName: string };
}

export interface LeadCollaboratorItem {
  id: string;
  userId: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  user?: { id: string; fullName: string };
}

export function LeadDetailPanels(props: {
  leadId: string;
  activities: LeadActivityItem[];
  assignments: LeadAssignmentItem[];
  collaborators: LeadCollaboratorItem[];
  onRefresh: () => void;
}) {
  const { leadId, activities, assignments, collaborators, onRefresh } = props;
  const [actType, setActType] = useState("CALL");
  const [summary, setSummary] = useState("");
  const [toUserId, setToUserId] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function runAction(fn: () => Promise<unknown>, fallbackMsg: string) {
    setError(null);
    try {
      await fn();
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : fallbackMsg);
    }
  }

  async function addActivity(e: React.FormEvent) {
    e.preventDefault();
    await runAction(async () => {
      await api(`/api/v1/leads/${leadId}/activities`, {
        method: "POST",
        body: JSON.stringify({ type: actType, summary }),
      });
      setSummary("");
    }, "บันทึกการติดต่อไม่สำเร็จ");
  }

  async function transferLead(e: React.FormEvent) {
    e.preventDefault();
    await runAction(async () => {
      await api(`/api/v1/leads/${leadId}/transfer`, {
        method: "POST",
        body: JSON.stringify({ toUserId, reason: transferReason }),
      });
      setToUserId("");
      setTransferReason("");
    }, "โอนผู้ดูแลไม่สำเร็จ");
  }

  const decideCollab = (userId: string, status: "APPROVED" | "REJECTED") =>
    runAction(
      () =>
        api(`/api/v1/leads/${leadId}/collaborators/${userId}`, {
          method: "PATCH",
          body: JSON.stringify({ status }),
        }),
      "อัปเดตผู้ร่วมงานไม่สำเร็จ",
    );

  const inputCls = "rounded border border-line bg-surface px-2.5 py-1.5 text-xs text-ink";

  return (
    <div className="space-y-6">
      {error && <p className="rounded bg-danger/10 p-3 text-sm text-danger">{error}</p>}

      <section className="space-y-3 rounded-lg border border-line bg-surface p-5">
        <h2 className="text-base font-semibold text-ink">{t("leads.activities.title")}</h2>
        <form onSubmit={addActivity} className="grid grid-cols-1 gap-2 sm:grid-cols-4">
          <select
            aria-label="ประเภทการติดต่อ"
            value={actType}
            onChange={(e) => setActType(e.target.value)}
            className={inputCls}
          >
            <option value="CALL">โทรศัพท์ (CALL)</option>
            <option value="CHAT">แชต LINE (CHAT)</option>
            <option value="NOTE">บันทึกช่วยจำ (NOTE)</option>
            <option value="FOLLOW_UP">ติดตามผล (FOLLOW_UP)</option>
          </select>
          <input
            required
            aria-label="รายละเอียดการติดต่อ"
            placeholder="สรุปผลการคุย..."
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            className={`${inputCls} sm:col-span-2`}
          />
          <button type="submit" className="rounded bg-brand px-3 py-1.5 text-xs text-white">
            บันทึกการติดต่อ
          </button>
        </form>
        <ul className="divide-y divide-line text-sm">
          {activities.map((a) => (
            <li key={a.id} className="py-2">
              <span className="font-medium text-ink">[{a.type}]</span> {a.summary}
              <span className="ml-2 text-xs text-ink-muted">
                โดย {a.user?.fullName ?? "-"} · {a.createdAt.slice(0, 10)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3 rounded-lg border border-line bg-surface p-5">
        <h2 className="text-base font-semibold text-ink">{t("leads.collab.title")}</h2>
        <ul className="divide-y divide-line text-sm">
          {collaborators.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-2">
              <span>
                {c.user?.fullName ?? c.userId} · สถานะ: <strong>{c.status}</strong>
              </span>
              {c.status === "PENDING" && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void decideCollab(c.userId, "APPROVED")}
                    className="rounded bg-brand px-2.5 py-1 text-xs text-white"
                  >
                    อนุมัติ
                  </button>
                  <button
                    type="button"
                    onClick={() => void decideCollab(c.userId, "REJECTED")}
                    className="rounded border border-line px-2.5 py-1 text-xs text-ink"
                  >
                    ปฏิเสธ
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3 rounded-lg border border-line bg-surface p-5">
        <h2 className="text-base font-semibold text-ink">{t("leads.transfer.button")}</h2>
        <form onSubmit={transferLead} className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <input
            required
            aria-label="รหัสผู้ดูแลใหม่"
            placeholder="User ID ผู้ดูแลใหม่"
            value={toUserId}
            onChange={(e) => setToUserId(e.target.value)}
            className={inputCls}
          />
          <input
            required
            aria-label="เหตุผลการโอนผู้ดูแล"
            placeholder="เหตุผลการโอน (จำเป็น)"
            value={transferReason}
            onChange={(e) => setTransferReason(e.target.value)}
            className={inputCls}
          />
          <button type="submit" className="rounded bg-brand px-3 py-1.5 text-xs font-medium text-white">
            ยืนยันโอนผู้ดูแล
          </button>
        </form>
        <ul className="divide-y divide-line text-xs text-ink-muted">
          {assignments.map((asgn) => (
            <li key={asgn.id} className="py-1.5">
              ผู้ดูแล: {asgn.toUser?.fullName ?? asgn.toUserId} · เหตุผล: {asgn.reason ?? "-"}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
