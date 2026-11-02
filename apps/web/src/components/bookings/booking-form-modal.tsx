"use client";

import { api, ApiError } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, FileSignature, X } from "lucide-react";
import { useState } from "react";
import { ImmediatePaymentSection } from "./booking-action-modals";
import { BOOKING_FORM_FIELDS, type PaymentMethodCode } from "./bookings.types";

export function BookingFormModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    leadId: "",
    assetId: "",
    monthlyRent: "25000",
    bookingFee: "10000",
    securityDeposit: "50000",
    advanceRent: "25000",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 365 * 86400_000).toISOString().slice(0, 10),
    payImmediately: false,
    paymentMethod: "BANK_TRANSFER" as PaymentMethodCode,
    paymentReference: "",
    note: "",
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const setField = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((prev) => ({ ...prev, [k]: v }));

  const { data: leadsData } = useQuery({
    queryKey: ["leads", "booking-options"],
    queryFn: () => api<{ items: Array<{ id: string; code: string; fullName: string }> }>("/api/v1/leads?pageSize=100"),
  });
  const { data: assetsData } = useQuery({
    queryKey: ["assets", "booking-options"],
    queryFn: () =>
      api<{ items: Array<{ id: string; code: string; unitNo: string | null; rentPrice: string | null }> }>(
        "/api/v1/assets?pageSize=100",
      ),
  });

  const createMut = useMutation({
    mutationFn: () =>
      api("/api/v1/bookings", {
        method: "POST",
        body: JSON.stringify({
          leadId: form.leadId,
          assetId: form.assetId,
          monthlyRent: Number(form.monthlyRent),
          bookingFee: Number(form.bookingFee),
          securityDeposit: Number(form.securityDeposit),
          advanceRent: Number(form.advanceRent),
          startDate: form.startDate,
          endDate: form.endDate,
          payImmediately: form.payImmediately,
          paymentMethod: form.paymentMethod,
          paymentReference: form.paymentReference.trim() || null,
          note: form.note.trim() || null,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["assets"] });
      qc.invalidateQueries({ queryKey: ["leads"] });
      onClose();
    },
    onError: (err) => setErrorMsg(err instanceof ApiError ? err.message : "สร้างการจองไม่สำเร็จ"),
  });

  const inputCls = "w-full rounded-lg border border-slate-300 px-3 py-2 text-xs";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <FileSignature className="h-5 w-5 text-blue-600" />
            สร้างการจองห้องเช่า (Booking)
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
            createMut.mutate();
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">ลูกค้า (Lead) *</label>
              <select
                aria-label="เลือกลูกค้า"
                required
                value={form.leadId}
                onChange={(e) => setField("leadId", e.target.value)}
                className={inputCls}
              >
                <option value="">-- เลือกลูกค้า --</option>
                {(leadsData?.items ?? []).map((l) => (
                  <option key={l.id} value={l.id}>{`${l.code} · ${l.fullName}`}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">ทรัพย์สิน/ห้องที่จอง *</label>
              <select
                aria-label="เลือกทรัพย์สิน"
                required
                value={form.assetId}
                onChange={(e) => {
                  const id = e.target.value;
                  const found = assetsData?.items.find((a) => a.id === id);
                  setForm((prev) => ({
                    ...prev,
                    assetId: id,
                    monthlyRent: found?.rentPrice ? String(found.rentPrice) : prev.monthlyRent,
                  }));
                }}
                className={inputCls}
              >
                <option value="">-- เลือกห้อง --</option>
                {(assetsData?.items ?? []).map((a) => (
                  <option key={a.id} value={a.id}>{`${a.code} ${a.unitNo ? `(${a.unitNo})` : ""}`}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {BOOKING_FORM_FIELDS.map((f) => (
              <div key={f.key}>
                <label className="mb-1 block text-xs font-medium text-slate-700">{f.label}</label>
                <input
                  type={f.type}
                  aria-label={f.aria}
                  required={f.req}
                  min={f.min}
                  value={form[f.key]}
                  onChange={(e) => setField(f.key, e.target.value)}
                  className={inputCls}
                />
              </div>
            ))}
          </div>

          <ImmediatePaymentSection
            payImmediately={form.payImmediately}
            paymentMethod={form.paymentMethod}
            paymentReference={form.paymentReference}
            onToggle={(v) => setField("payImmediately", v)}
            onChangeMethod={(v) => setField("paymentMethod", v)}
            onChangeRef={(v) => setField("paymentReference", v)}
          />

          <input
            type="text"
            aria-label="หมายเหตุการจอง"
            placeholder="หมายเหตุเพิ่มเติม..."
            value={form.note}
            onChange={(e) => setField("note", e.target.value)}
            className={inputCls}
          />

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={createMut.isPending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
            >
              {createMut.isPending ? "กำลังบันทึก..." : "บันทึกการจอง"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
