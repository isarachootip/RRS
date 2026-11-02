"use client";

import { api, ApiError } from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Ban, X } from "lucide-react";
import { useState } from "react";
import { type BookingItem, PAYMENT_METHOD_LABELS, type PaymentMethodCode } from "./bookings.types";

export { PayBookingModal } from "./pay-booking-modal";

const PAYMENT_METHODS = Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethodCode[];

export function ImmediatePaymentSection({
  payImmediately,
  paymentMethod,
  paymentReference,
  onToggle,
  onChangeMethod,
  onChangeRef,
}: {
  payImmediately: boolean;
  paymentMethod: PaymentMethodCode;
  paymentReference: string;
  onToggle: (v: boolean) => void;
  onChangeMethod: (v: PaymentMethodCode) => void;
  onChangeRef: (v: string) => void;
}) {
  const inputCls = "w-full rounded-lg border border-slate-300 px-3 py-2 text-xs";
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <label className="flex items-center gap-2 text-xs font-semibold text-slate-800">
        <input type="checkbox" checked={payImmediately} onChange={(e) => onToggle(e.target.checked)} />
        รับชำระเงินจองทันที (ล็อกช่วงวันที่ของห้องทันที)
      </label>
      {payImmediately && (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <select
            aria-label="ช่องทางชำระเงิน"
            value={paymentMethod}
            onChange={(e) => onChangeMethod(e.target.value as PaymentMethodCode)}
            className={inputCls}
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_LABELS[m]}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="เลขอ้างอิงสลิป เช่น SLIP-20261102"
            value={paymentReference}
            onChange={(e) => onChangeRef(e.target.value)}
            className={inputCls}
          />
        </div>
      )}
    </div>
  );
}

export function CancelBookingModal({ booking, onClose }: { booking: BookingItem; onClose: () => void }) {
  const qc = useQueryClient();
  const [cancelReason, setCancelReason] = useState("");
  const [feeForfeited, setFeeForfeited] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const cancelMut = useMutation({
    mutationFn: () =>
      api(`/api/v1/bookings/${booking.id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ cancelReason: cancelReason.trim(), feeForfeited }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["assets"] });
      onClose();
    },
    onError: (err) => {
      setErrorMsg(err instanceof ApiError ? err.message : "ยกเลิกการจองไม่สำเร็จ");
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
            <Ban className="h-5 w-5 text-rose-600" />
            ยกเลิกการจอง ({booking.code})
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
            cancelMut.mutate();
          }}
        >
          {errorMsg && (
            <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">เหตุผลการยกเลิก *</label>
            <textarea
              aria-label="เหตุผลการยกเลิก"
              required
              rows={3}
              placeholder="ระบุสาเหตุที่ยกเลิกการจอง..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">การจัดการเงินจอง *</label>
            <select
              aria-label="การจัดการเงินจอง"
              value={feeForfeited ? "FORFEIT" : "REFUND"}
              onChange={(e) => setFeeForfeited(e.target.value === "FORFEIT")}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
            >
              <option value="FORFEIT">ยึดเงินจอง (ลูกค้าผิดเงื่อนไข)</option>
              <option value="REFUND">คืนเงินจองให้ลูกค้า</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700"
            >
              ปิด
            </button>
            <button
              type="submit"
              disabled={cancelMut.isPending}
              className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-50"
            >
              {cancelMut.isPending ? "กำลังดำเนินการ..." : "ยืนยันยกเลิกการจอง"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
