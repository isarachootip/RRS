"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { FORMULA_LABELS, ROLE_LABELS, STATUS_LABELS, type CommissionRecord } from "./commissions.types";

export function CommissionsDealsTable({
  commissions,
  onEdit,
  onApprove,
  onReceive,
}: {
  commissions: CommissionRecord[];
  onEdit: (c: CommissionRecord) => void;
  onApprove: (id: string) => void;
  onReceive: (c: CommissionRecord) => void;
}) {
  return (
    <div className="overflow-x-auto rounded border bg-white">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-gray-50 text-left text-gray-600">
            <th className="border-b p-3">ห้อง / ดีล</th>
            <th className="border-b p-3">สูตรคำนวณ</th>
            <th className="border-b p-3 text-right">ยอดรวม (บาท)</th>
            <th className="border-b p-3">ส่วนแบ่ง (ฉบับปัจจุบัน)</th>
            <th className="border-b p-3">สถานะ</th>
            <th className="border-b p-3 text-right">การดำเนินการ</th>
          </tr>
        </thead>
        <tbody>
          {commissions.map((c) => (
            <tr key={c.id} className="border-b hover:bg-gray-50">
              <td className="p-3">
                <div className="font-semibold text-gray-900">
                  {c.asset.code} ({c.ownershipType})
                </div>
                <div className="text-gray-500">
                  {c.contract?.contractNo ?? c.saleDeal?.code ?? "-"} · ฉบับที่ {c.currentRevision}
                </div>
              </td>
              <td className="p-3">{FORMULA_LABELS[c.formula]}</td>
              <td className="p-3 text-right font-semibold">{c.totalAmount}</td>
              <td className="p-3">
                {c.currentSplits.map((s) => (
                  <div key={s.id} className="text-gray-700">
                    {ROLE_LABELS[s.role]}: {s.user?.fullName ?? "บริษัท"} = {s.netAmount} บ.
                  </div>
                ))}
              </td>
              <td className="p-3">
                <span className="rounded bg-blue-50 px-2 py-0.5 font-medium text-blue-800">
                  {STATUS_LABELS[c.status]}
                </span>
              </td>
              <td className="space-x-1 p-3 text-right">
                <button type="button" onClick={() => onEdit(c)} className="rounded border px-2 py-1 text-xs">
                  คำนวณ/แก้ไขส่วนแบ่ง
                </button>
                {c.status === "PENDING_REVIEW" && (
                  <button
                    type="button"
                    onClick={() => onApprove(c.id)}
                    className="rounded bg-blue-600 px-2 py-1 text-xs text-white"
                  >
                    อนุมัติ
                  </button>
                )}
                {c.ownershipType === "AGENT" && ["APPROVED", "AWAITING_OWNER_PAYMENT"].includes(c.status) && (
                  <button
                    type="button"
                    onClick={() => onReceive(c)}
                    className="rounded bg-emerald-600 px-2 py-1 text-xs text-white"
                  >
                    รับเงินเจ้าของห้อง
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

export function ReceiveOwnerPaymentModal({
  commission,
  onClose,
  onSaved,
}: {
  commission: CommissionRecord;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState(commission.totalAmount);
  const [method, setMethod] = useState("BANK_TRANSFER");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setSaving(true);
    setError("");
    try {
      await api(`/api/v1/commissions/${commission.id}/receive`, {
        method: "POST",
        body: JSON.stringify({ amount, method, reference: reference || undefined, note: note || undefined }),
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกรับเงินไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h3 className="mb-3 text-base font-semibold">
          บันทึกรับเงินค่านายหน้าจากเจ้าของห้อง · {commission.asset.code}
        </h3>
        <div className="space-y-3 text-xs">
          <label className="block font-medium">
            จำนวนเงินที่รับ (บาท)
            <input
              aria-label="จำนวนเงินที่รับ"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            />
          </label>
          <label className="block font-medium">
            วิธีชำระเงิน
            <select
              aria-label="วิธีชำระเงิน"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            >
              <option value="BANK_TRANSFER">โอนเงินผ่านธนาคาร</option>
              <option value="PROMPTPAY">พร้อมเพย์</option>
              <option value="CASH">เงินสด</option>
              <option value="CHEQUE">เช็ค</option>
            </select>
          </label>
          <label className="block font-medium">
            เลขอ้างอิงสลิป / หลักฐาน
            <input
              aria-label="เลขอ้างอิงสลิป"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="เช่น SLIP-20261105-01"
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            />
          </label>
          <label className="block font-medium">
            หมายเหตุ
            <input
              aria-label="หมายเหตุรับเงิน"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            />
          </label>
          {error && <div className="rounded bg-red-50 p-2 text-red-700">{error}</div>}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded border px-3 py-1.5 text-xs">
            ยกเลิก
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSubmit}
            className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            ยืนยันรับเงิน
          </button>
        </div>
      </div>
    </div>
  );
}
