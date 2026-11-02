"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { EXPENSE_CATEGORY_LABELS, type ExpenseCategory } from "./finance.types";

export function RecordExpenseModal({
  assets,
  onClose,
  onSuccess,
}: {
  assets: Array<{ id: string; code: string; unitNo: string | null }>;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [assetId, setAssetId] = useState(assets[0]?.id ?? "");
  const [category, setCategory] = useState<ExpenseCategory>("COMMON_FEE");
  const [amount, setAmount] = useState("1800.00");
  const [incurredAt, setIncurredAt] = useState("2027-01-10");
  const [vendor, setVendor] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api("/api/v1/finance/expenses", {
        method: "POST",
        body: JSON.stringify({ assetId, category, amount, incurredAt, paidAt: incurredAt, vendor: vendor || null }),
      });
      onSuccess();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">บันทึกค่าใช้จ่ายต่อทรัพย์สิน</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <select
            aria-label="ทรัพย์สิน"
            value={assetId}
            onChange={(e) => setAssetId(e.target.value)}
            required
            className="w-full rounded border px-3 py-2 text-sm"
          >
            <option value="">-- เลือกห้อง --</option>
            {assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} {a.unitNo ? `(${a.unitNo})` : ""}
              </option>
            ))}
          </select>
          <select
            aria-label="หมวดค่าใช้จ่าย"
            value={category}
            onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
            className="w-full rounded border px-3 py-2 text-sm"
          >
            {(Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[]).map((k) => (
              <option key={k} value={k}>
                {EXPENSE_CATEGORY_LABELS[k]}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <input
              aria-label="จำนวนเงินค่าใช้จ่าย"
              type="text"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="rounded border px-3 py-2 text-sm"
            />
            <input
              aria-label="วันที่จ่าย"
              type="date"
              required
              value={incurredAt}
              onChange={(e) => setIncurredAt(e.target.value)}
              className="rounded border px-3 py-2 text-sm"
            />
          </div>
          <input
            aria-label="ผู้รับเงิน/ร้านค้า"
            placeholder="ชื่อผู้รับเงิน / นิติบุคคล"
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
            className="w-full rounded border px-3 py-2 text-sm"
          />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded border px-4 py-2 text-sm">
              ยกเลิก
            </button>
            <button type="submit" disabled={saving} className="rounded bg-blue-600 px-4 py-2 text-sm text-white">
              บันทึกค่าใช้จ่าย
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
