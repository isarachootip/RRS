"use client";

import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Ban, CreditCard, FileSignature, Plus } from "lucide-react";
import { useState } from "react";
import { CancelBookingModal, PayBookingModal } from "./booking-action-modals";
import { BookingFormModal } from "./booking-form-modal";
import {
  BOOKING_STATUS_COLORS,
  BOOKING_STATUS_LABELS,
  type BookingItem,
  type BookingStatusCode,
  formatMoney,
  formatThaiDate,
} from "./bookings.types";

const STATUS_KEYS = Object.keys(BOOKING_STATUS_LABELS) as BookingStatusCode[];

export function BookingsView() {
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [payTarget, setPayTarget] = useState<BookingItem | null>(null);
  const [cancelTarget, setCancelTarget] = useState<BookingItem | null>(null);

  const queryStr = statusFilter ? `?status=${statusFilter}` : "";
  const { data: bookings, isLoading } = useQuery({
    queryKey: ["bookings", statusFilter],
    queryFn: () => api<BookingItem[]>(`/api/v1/bookings${queryStr}`),
  });

  const items = bookings ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <FileSignature className="h-6 w-6 text-blue-600" />
            การจองห้องเช่า (Bookings)
          </h1>
          <p className="text-sm text-slate-600">
            จัดการใบจองห้อง รับชำระเงินจอง ล็อกช่วงวันที่ไม่ให้จองซ้อน และแปลงเป็นสัญญาเช่า
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" /> สร้างการจองใหม่
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => setStatusFilter("")}
            className={`rounded-lg px-3 py-1.5 font-medium ${
              statusFilter === "" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            ทั้งหมด ({items.length})
          </button>
          {STATUS_KEYS.map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`rounded-lg px-3 py-1.5 font-medium ${
                statusFilter === st ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {BOOKING_STATUS_LABELS[st]}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          กำลังโหลดรายการจอง...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          ยังไม่มีรายการจองในหมวดหมู่นี้
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {items.map((bk) => (
            <div
              key={bk.id}
              data-testid={`booking-card-${bk.code}`}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-bold text-slate-900">{bk.code}</span>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${BOOKING_STATUS_COLORS[bk.status]}`}
                    >
                      {BOOKING_STATUS_LABELS[bk.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-800">
                    ลูกค้า: <span className="font-semibold">{bk.lead.fullName}</span> ({bk.lead.code}) · ห้อง:{" "}
                    <span className="font-semibold">{bk.asset.code}</span>{" "}
                    {bk.asset.project?.name ? `(${bk.asset.project.name})` : ""}{" "}
                    {bk.asset.unitNo ? `ห้อง ${bk.asset.unitNo}` : ""}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-600">
                    ช่วงสัญญา: {formatThaiDate(bk.startDate)} – {formatThaiDate(bk.endDate)}
                  </p>
                  {bk.cancelReason && (
                    <p className="mt-1 text-xs font-medium text-rose-700">
                      เหตุผลยกเลิก: {bk.cancelReason} ({bk.feeForfeited ? "ยึดเงินจอง" : "คืนเงินจอง"})
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {bk.status === "PENDING_PAYMENT" && (
                    <button
                      type="button"
                      onClick={() => setPayTarget(bk)}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 font-medium text-white hover:bg-emerald-700"
                    >
                      <CreditCard className="h-3.5 w-3.5" /> ยืนยันรับชำระ
                    </button>
                  )}
                  {(bk.status === "PENDING_PAYMENT" || bk.status === "PAID") && (
                    <button
                      type="button"
                      onClick={() => setCancelTarget(bk)}
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 font-medium text-rose-700 hover:bg-rose-100"
                    >
                      <Ban className="h-3.5 w-3.5" /> ยกเลิกการจอง
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 text-xs sm:grid-cols-4">
                <div>
                  <span className="text-slate-500">ค่าเช่า/เดือน</span>
                  <div className="font-bold text-slate-900">฿{formatMoney(bk.monthlyRent)}</div>
                </div>
                <div>
                  <span className="text-slate-500">เงินจอง</span>
                  <div className="font-bold text-emerald-700">฿{formatMoney(bk.bookingFee)}</div>
                </div>
                <div>
                  <span className="text-slate-500">เงินประกัน</span>
                  <div className="font-semibold text-slate-800">฿{formatMoney(bk.securityDeposit)}</div>
                </div>
                <div>
                  <span className="text-slate-500">ค่าเช่าล่วงหน้า</span>
                  <div className="font-semibold text-slate-800">฿{formatMoney(bk.advanceRent)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && <BookingFormModal onClose={() => setShowCreateModal(false)} />}
      {payTarget && <PayBookingModal booking={payTarget} onClose={() => setPayTarget(null)} />}
      {cancelTarget && <CancelBookingModal booking={cancelTarget} onClose={() => setCancelTarget(null)} />}
    </div>
  );
}
