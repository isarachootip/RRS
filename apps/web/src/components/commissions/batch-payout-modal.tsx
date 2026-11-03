"use client";

import { fromSatang, toSatang } from "@rrs/shared";
import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import { ROLE_LABELS, type CommissionPayoutRecord, type CommissionRecord } from "./commissions.types";

export function PayoutsTable({ payouts, onPay }: { payouts: CommissionPayoutRecord[]; onPay: (id: string) => void }) {
  return (
    <div className="overflow-x-auto rounded border bg-white">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-gray-50 text-left text-gray-600">
            <th className="border-b p-3">งวดรอบจ่าย</th>
            <th className="border-b p-3">Agent ผู้รับเงิน</th>
            <th className="border-b p-3 text-right">ยอดโอนสุทธิ (บาท)</th>
            <th className="border-b p-3">สถานะ</th>
            <th className="border-b p-3 text-right">การดำเนินการ</th>
          </tr>
        </thead>
        <tbody>
          {payouts.map((p) => (
            <tr key={p.id} className="border-b">
              <td className="p-3 font-medium">{p.periodLabel}</td>
              <td className="p-3">{p.user.fullName}</td>
              <td className="p-3 text-right font-semibold">{p.totalAmount}</td>
              <td className="p-3">{p.status === "PAID" ? "จ่ายแล้ว" : "รอโอนจ่าย"}</td>
              <td className="p-3 text-right">
                {p.status !== "PAID" && (
                  <button
                    type="button"
                    onClick={() => onPay(p.id)}
                    className="rounded bg-emerald-600 px-2 py-1 text-xs text-white"
                  >
                    ยืนยันโอนจ่ายแล้ว
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function BatchPayoutModal({
  commissions,
  onClose,
  onSaved,
}: {
  commissions: CommissionRecord[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const payableSplits = useMemo(() => {
    return commissions.flatMap((c) => {
      const ready =
        (c.ownershipType === "AGENT" && ["RECEIVED", "AWAITING_PAYOUT"].includes(c.status)) ||
        (c.ownershipType === "OWNER" && ["APPROVED", "AWAITING_PAYOUT"].includes(c.status));
      if (!ready) return [];
      return c.currentSplits
        .filter((s) => s.role !== "COMPANY" && s.userId && !s.payoutId)
        .map((s) => ({ ...s, assetCode: c.asset.code }));
    });
  }, [commissions]);

  const agents = useMemo(() => {
    const map = new Map<string, string>();
    payableSplits.forEach((s) => {
      if (s.userId) map.set(s.userId, s.user?.fullName ?? s.userId);
    });
    return Array.from(map.entries()).map(([id, fullName]) => ({ id, fullName }));
  }, [payableSplits]);

  const [selectedUserId, setSelectedUserId] = useState(agents[0]?.id ?? "");
  const [periodLabel, setPeriodLabel] = useState("รอบวันที่ 5 ของเดือน");
  const [payImmediately, setPayImmediately] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const userSplits = useMemo(
    () => payableSplits.filter((s) => s.userId === selectedUserId),
    [payableSplits, selectedUserId],
  );
  const totalBaht = useMemo(
    () => fromSatang(userSplits.reduce((acc, s) => acc + toSatang(s.netAmount), 0n)),
    [userSplits],
  );

  const handleSubmit = async () => {
    if (!selectedUserId || userSplits.length === 0) return;
    setSaving(true);
    setError("");
    try {
      await api("/api/v1/commissions/payouts", {
        method: "POST",
        body: JSON.stringify({
          userId: selectedUserId,
          periodLabel,
          splitIds: userSplits.map((s) => s.id),
          payImmediately,
          method: "BANK_TRANSFER",
        }),
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "สร้างรอบจ่ายไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <h3 className="mb-3 text-base font-semibold">สร้างรอบจ่ายส่วนแบ่ง Agent (รวมหลายดีล)</h3>
        <div className="space-y-3 text-xs">
          <label className="block font-medium">
            เลือก Agent ผู้รับเงิน
            <select
              aria-label="เลือก Agent ผู้รับเงิน"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            >
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.fullName}
                </option>
              ))}
            </select>
          </label>
          <label className="block font-medium">
            ชื่องวดรอบจ่าย
            <input
              aria-label="ชื่องวดรอบจ่าย"
              value={periodLabel}
              onChange={(e) => setPeriodLabel(e.target.value)}
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            />
          </label>
          <div className="rounded border bg-gray-50 p-2">
            <div className="mb-1 font-medium">รายการดีลที่จะรวมจ่าย ({userSplits.length} รายการ):</div>
            {userSplits.map((s) => (
              <div key={s.id} className="flex justify-between py-0.5 text-gray-700">
                <span>
                  {s.assetCode} ({ROLE_LABELS[s.role]})
                </span>
                <span>สุทธิ {s.netAmount} บาท</span>
              </div>
            ))}
            <div className="mt-2 border-t pt-1 font-semibold text-blue-900">รวมจ่ายสุทธิ: {totalBaht} บาท</div>
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={payImmediately} onChange={(e) => setPayImmediately(e.target.checked)} />
            บันทึกจ่ายโอนเงินทันที
          </label>
          {error && <div className="rounded bg-red-50 p-2 text-red-700">{error}</div>}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded border px-3 py-1.5 text-xs">
            ยกเลิก
          </button>
          <button
            type="button"
            disabled={saving || userSplits.length === 0}
            onClick={handleSubmit}
            className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            ยืนยันสร้างรอบจ่าย
          </button>
        </div>
      </div>
    </div>
  );
}
