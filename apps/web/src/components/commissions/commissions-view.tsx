"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { BatchPayoutModal, PayoutsTable } from "./batch-payout-modal";
import { CommissionsDealsTable, ReceiveOwnerPaymentModal } from "./commission-action-modals";
import { CommissionSplitModal } from "./commission-split-modal";
import {
  STATUS_LABELS,
  type CommissionPayoutRecord,
  type CommissionRecord,
  type CommissionStatus,
} from "./commissions.types";

export function CommissionsView() {
  const [tab, setTab] = useState<"DEALS" | "PAYOUTS">("DEALS");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [commissions, setCommissions] = useState<CommissionRecord[]>([]);
  const [payouts, setPayouts] = useState<CommissionPayoutRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<CommissionRecord | null>(null);
  const [receiving, setReceiving] = useState<CommissionRecord | null>(null);
  const [showBatchPayout, setShowBatchPayout] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const qs = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : "";
      const [comRes, payRes] = await Promise.all([
        api<CommissionRecord[]>(`/api/v1/commissions${qs}`),
        api<CommissionPayoutRecord[]>("/api/v1/commissions/payouts"),
      ]);
      setCommissions(comRes);
      setPayouts(payRes);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleApprove = async (id: string) => {
    await api(`/api/v1/commissions/${id}/approve`, { method: "POST", body: JSON.stringify({}) });
    await loadData();
  };

  const handlePayPayout = async (payoutId: string) => {
    await api(`/api/v1/commissions/payouts/${payoutId}/pay`, {
      method: "POST",
      body: JSON.stringify({ method: "BANK_TRANSFER" }),
    });
    await loadData();
  };

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">ค่านายหน้าและการจ่ายส่วนแบ่ง (Commissions & Payouts)</h1>
          <p className="text-xs text-gray-500">
            คำนวณค่านายหน้าตามสูตร แบ่งตามบทบาท อนุมัติพร้อม Snapshot และจ่ายส่วนแบ่ง Agent เป็นรอบ
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowBatchPayout(true)}
          className="rounded bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700"
        >
          + สร้างรอบจ่ายส่วนแบ่ง Agent
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTab("DEALS")}
            className={`rounded px-3 py-1.5 text-xs font-medium ${tab === "DEALS" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700"}`}
          >
            รายการค่านายหน้าตามสัญญา/ดีล ({commissions.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("PAYOUTS")}
            className={`rounded px-3 py-1.5 text-xs font-medium ${tab === "PAYOUTS" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700"}`}
          >
            รอบจ่ายส่วนแบ่ง Agent ({payouts.length})
          </button>
        </div>
        {tab === "DEALS" && (
          <select
            aria-label="กรองสถานะค่านายหน้า"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded border px-2 py-1 text-xs"
          >
            <option value="">ทุกสถานะ</option>
            {(Object.keys(STATUS_LABELS) as CommissionStatus[]).map((st) => (
              <option key={st} value={st}>
                {STATUS_LABELS[st]}
              </option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <div className="py-8 text-center text-sm text-gray-500">กำลังโหลดข้อมูลค่านายหน้า...</div>
      ) : tab === "DEALS" ? (
        <CommissionsDealsTable
          commissions={commissions}
          onEdit={(c) => setEditing(c)}
          onApprove={(id) => void handleApprove(id)}
          onReceive={(c) => setReceiving(c)}
        />
      ) : (
        <PayoutsTable payouts={payouts} onPay={(id) => void handlePayPayout(id)} />
      )}

      {editing && (
        <CommissionSplitModal
          commission={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void loadData();
          }}
        />
      )}
      {receiving && (
        <ReceiveOwnerPaymentModal
          commission={receiving}
          onClose={() => setReceiving(null)}
          onSaved={() => {
            setReceiving(null);
            void loadData();
          }}
        />
      )}
      {showBatchPayout && (
        <BatchPayoutModal
          commissions={commissions}
          onClose={() => setShowBatchPayout(false)}
          onSaved={() => {
            setShowBatchPayout(false);
            void loadData();
          }}
        />
      )}
    </div>
  );
}
