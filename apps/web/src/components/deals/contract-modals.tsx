"use client";

import { api, ApiError } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useState } from "react";
import type { BookingItem } from "../bookings/bookings.types";
import type { ContractItem } from "./deals.types";

const inpCls = "w-full rounded-lg border border-slate-300 px-3 py-2 text-xs";

export function ConvertBookingContractModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [bookingId, setBookingId] = useState("");
  const [activateNow, setActivateNow] = useState(true);
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const { data: paidBookings } = useQuery({
    queryKey: ["bookings", "PAID"],
    queryFn: () => api<BookingItem[]>("/api/v1/bookings?status=PAID"),
  });

  const mut = useMutation({
    mutationFn: () =>
      api("/api/v1/contracts", {
        method: "POST",
        body: JSON.stringify({
          bookingId,
          status: activateNow ? "ACTIVE" : "DRAFT",
          note: note.trim() || null,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contracts"] });
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["assets"] });
      onClose();
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : "สร้างสัญญาไม่สำเร็จ"),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h2 className="text-base font-bold text-slate-900">แปลงการจองเป็นสัญญาเช่า</h2>
          <button type="button" aria-label="ปิด" onClick={onClose} className="rounded p-1 hover:bg-slate-100">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>
        <form
          className="mt-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            mut.mutate();
          }}
        >
          {err && <div className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{err}</div>}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">เลือกใบจองที่ชำระแล้ว *</label>
            <select
              aria-label="เลือกใบจองที่ชำระแล้ว"
              required
              value={bookingId}
              onChange={(e) => setBookingId(e.target.value)}
              className={inpCls}
            >
              <option value="">-- เลือกใบจอง --</option>
              {(paidBookings ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {`${b.code} · ${b.lead.fullName} (${b.asset.code})`}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
            <input type="checkbox" checked={activateNow} onChange={(e) => setActivateNow(e.target.checked)} />
            ลงนามและมีผลบังคับใช้ทันที (ACTIVE + สร้าง Commission รอคำนวณ)
          </label>
          <input
            type="text"
            placeholder="หมายเหตุสัญญา..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={inpCls}
          />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-xs">
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={mut.isPending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white"
            >
              สร้างสัญญาเช่า
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ReviseContractModal({ contract, onClose }: { contract: ContractItem; onClose: () => void }) {
  const qc = useQueryClient();
  const [monthlyRent, setMonthlyRent] = useState(String(contract.monthlyRent));
  const [note, setNote] = useState(contract.note ?? "");
  const [err, setErr] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: () =>
      api(`/api/v1/contracts/${contract.id}`, {
        method: "PATCH",
        body: JSON.stringify({ monthlyRent: Number(monthlyRent), note: note.trim() || null }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contracts"] });
      onClose();
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : "แก้ไขสัญญาไม่สำเร็จ"),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h2 className="text-base font-bold text-slate-900">
            {contract.status === "ACTIVE"
              ? `สร้าง Revision ใหม่ (${contract.contractNo})`
              : `แก้ไขสัญญา (${contract.contractNo})`}
          </h2>
          <button type="button" aria-label="ปิด" onClick={onClose} className="rounded p-1 hover:bg-slate-100">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>
        <form
          className="mt-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            mut.mutate();
          }}
        >
          {err && <div className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{err}</div>}
          {contract.status === "ACTIVE" && (
            <p className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800">
              สัญญามีผลบังคับใช้แล้ว ระบบจะสร้างแถวใหม่ Revision {contract.revision + 1} และเก็บสัญญาเดิมไว้เป็น
              SUPERSEDED
            </p>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">ค่าเช่าต่อเดือนใหม่ (บาท) *</label>
            <input
              type="number"
              aria-label="ค่าเช่าต่อเดือนใหม่"
              required
              min="1"
              value={monthlyRent}
              onChange={(e) => setMonthlyRent(e.target.value)}
              className={inpCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">หมายเหตุการแก้ไข</label>
            <input
              type="text"
              aria-label="หมายเหตุการแก้ไข"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={inpCls}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-xs">
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={mut.isPending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white"
            >
              บันทึก Revision
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
