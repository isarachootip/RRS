"use client";

import { fromSatang, toSatang } from "@rrs/shared";
import { useState } from "react";
import { api } from "@/lib/api";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_TYPE_LABELS,
  type PaymentMethod,
  type PaymentType,
  type RentScheduleRecord,
} from "./finance.types";

export function RecordPaymentModal({
  schedule,
  onClose,
  onSuccess,
}: {
  schedule?: RentScheduleRecord | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const defaultRemaining = schedule
    ? fromSatang(toSatang(schedule.amountDue) - toSatang(schedule.amountPaid))
    : "10000.00";
  const [type, setType] = useState<PaymentType>("MONTHLY_RENT");
  const [amount, setAmount] = useState(defaultRemaining);
  const [method, setMethod] = useState<PaymentMethod>("BANK_TRANSFER");
  const [paidAt, setPaidAt] = useState("2027-01-05");
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api("/api/v1/finance/payments", {
        method: "POST",
        body: JSON.stringify({
          type,
          direction: type === "REFUND" ? "OUT" : "IN",
          amount,
          paidAt: `${paidAt}T10:00:00.000Z`,
          method,
          reference: reference.trim() || null,
          rentScheduleId: schedule?.id ?? null,
        }),
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกรับเงินไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between border-b pb-3">
          <h2 className="text-lg font-semibold text-slate-900">
            {schedule ? `รับชำระค่าเช่า · ${schedule.contract.contractNo}` : "บันทึกรายการรับ/จ่ายเงิน"}
          </h2>
          <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:text-slate-800">
            ปิด
          </button>
        </div>
        {error && <div className="mb-3 rounded bg-red-50 p-2.5 text-sm text-red-700">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="pay-type" className="block text-xs font-medium text-slate-700">
              ประเภทรายการ
            </label>
            <select
              id="pay-type"
              value={type}
              onChange={(e) => setType(e.target.value as PaymentType)}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
            >
              {(Object.keys(PAYMENT_TYPE_LABELS) as PaymentType[]).map((k) => (
                <option key={k} value={k}>
                  {PAYMENT_TYPE_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="pay-amount" className="block text-xs font-medium text-slate-700">
                จำนวนเงิน (บาท.สตางค์)
              </label>
              <input
                id="pay-amount"
                type="text"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="pay-date" className="block text-xs font-medium text-slate-700">
                วันที่รับ/จ่ายเงิน
              </label>
              <input
                id="pay-date"
                type="date"
                required
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="pay-method" className="block text-xs font-medium text-slate-700">
                ช่องทาง
              </label>
              <select
                id="pay-method"
                value={method}
                onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
              >
                {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((k) => (
                  <option key={k} value={k}>
                    {PAYMENT_METHOD_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="pay-ref" className="block text-xs font-medium text-slate-700">
                เลขอ้างอิงสลิป
              </label>
              <input
                id="pay-ref"
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded border px-4 py-2 text-sm text-slate-700">
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? "กำลังบันทึก..." : "ยืนยันรับเงิน"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
