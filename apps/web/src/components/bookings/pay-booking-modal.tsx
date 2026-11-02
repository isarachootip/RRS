"use client";

import { api, ApiError } from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CreditCard, X } from "lucide-react";
import { useState } from "react";
import { type BookingItem, formatMoney, PAYMENT_METHOD_LABELS, type PaymentMethodCode } from "./bookings.types";

const PAYMENT_METHODS = Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethodCode[];

export function PayBookingModal({ booking, onClose }: { booking: BookingItem; onClose: () => void }) {
  const qc = useQueryClient();
  const [method, setMethod] = useState<PaymentMethodCode>("BANK_TRANSFER");
  const [reference, setReference] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const payMut = useMutation({
    mutationFn: () =>
      api(`/api/v1/bookings/${booking.id}/pay`, {
        method: "POST",
        body: JSON.stringify({
          method,
          reference: reference.trim() || null,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["assets"] });
      qc.invalidateQueries({ queryKey: ["leads"] });
      onClose();
    },
    onError: (err) => {
      setErrorMsg(err instanceof ApiError ? err.message : "ยืนยันรับชำระเงินไม่สำเร็จ");
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
            <CreditCard className="h-5 w-5 text-emerald-600" />
            ยืนยันรับชำระเงินจอง ({booking.code})
          </h2>
          <button type="button" aria-label="ปิด" onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        <form
          className="mt-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setErrorMsg(null);
            payMut.mutate();
          }}
        >
          {errorMsg && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
            <div>
              ห้อง: <span className="font-semibold">{booking.asset.code}</span>
            </div>
            <div>
              ลูกค้า: <span className="font-semibold">{booking.lead.fullName}</span>
            </div>
            <div>
              ยอดเงินจอง: <span className="font-bold text-emerald-700">฿{formatMoney(booking.bookingFee)}</span>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">ช่องทางชำระเงิน *</label>
            <select
              aria-label="ช่องทางชำระเงินจอง"
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethodCode)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_METHOD_LABELS[m]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">เลขอ้างอิงสลิป / ใบเสร็จ</label>
            <input
              type="text"
              aria-label="เลขอ้างอิงสลิป"
              placeholder="เช่น SLIP-001"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={payMut.isPending}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {payMut.isPending ? "กำลังบันทึก..." : "ยืนยันรับชำระและล็อกห้อง"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
