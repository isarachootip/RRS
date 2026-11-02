"use client";

import { api } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Edit3, FilePlus2, FileText } from "lucide-react";
import { useState } from "react";
import { formatMoney, formatThaiDate } from "../bookings/bookings.types";
import { ConvertBookingContractModal, ReviseContractModal } from "./contract-modals";
import {
  CONTRACT_STATUS_COLORS,
  CONTRACT_STATUS_LABELS,
  type ContractItem,
  type ContractStatusCode,
} from "./deals.types";

const STATUS_KEYS = Object.keys(CONTRACT_STATUS_LABELS) as ContractStatusCode[];

export function ContractsTab() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("");
  const [includeSuperseded, setIncludeSuperseded] = useState(true);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [reviseTarget, setReviseTarget] = useState<ContractItem | null>(null);

  const params = new URLSearchParams({
    ...(statusFilter ? { status: statusFilter } : {}),
    includeSuperseded: String(includeSuperseded),
  });

  const { data: contracts, isLoading } = useQuery({
    queryKey: ["contracts", params.toString()],
    queryFn: () => api<ContractItem[]>(`/api/v1/contracts?${params.toString()}`),
  });

  const signMut = useMutation({
    mutationFn: (id: string) => api(`/api/v1/contracts/${id}/sign`, { method: "POST", body: JSON.stringify({}) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contracts"] });
      qc.invalidateQueries({ queryKey: ["assets"] });
    },
  });

  const items = contracts ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => setStatusFilter("")}
            className={`rounded-lg px-3 py-1.5 font-medium ${
              statusFilter === "" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"
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
                statusFilter === st ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"
              }`}
            >
              {CONTRACT_STATUS_LABELS[st]}
            </button>
          ))}
          <label className="ml-2 flex items-center gap-1.5 text-slate-600">
            <input
              type="checkbox"
              checked={includeSuperseded}
              onChange={(e) => setIncludeSuperseded(e.target.checked)}
            />
            แสดงประวัติ Revision ทั้งหมด
          </label>
        </div>

        <button
          type="button"
          onClick={() => setShowConvertModal(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-700"
        >
          <FilePlus2 className="h-4 w-4" /> แปลงการจองเป็นสัญญา
        </button>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          กำลังโหลดรายการสัญญาเช่า...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          ยังไม่มีรายการสัญญาเช่า
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {items.map((c) => (
            <div
              key={c.id}
              data-testid={`contract-card-${c.contractNo}`}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-600" />
                    <span className="text-base font-bold text-slate-900">{c.contractNo}</span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                      Rev.{c.revision}
                    </span>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${CONTRACT_STATUS_COLORS[c.status]}`}
                    >
                      {CONTRACT_STATUS_LABELS[c.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-800">
                    ผู้เช่า: <span className="font-semibold">{c.lead.fullName}</span> · ห้อง:{" "}
                    <span className="font-semibold">{c.asset.code}</span> {c.asset.unitNo ? `(${c.asset.unitNo})` : ""}{" "}
                    · ค่าเช่า <span className="font-bold text-emerald-700">฿{formatMoney(c.monthlyRent)}/เดือน</span>
                  </p>
                  <p className="mt-0.5 text-xs text-slate-600">
                    ระยะเวลาสัญญา: {formatThaiDate(c.startDate)} – {formatThaiDate(c.endDate)}
                    {c.revisionOf && ` · แก้ไขมาจาก ${c.revisionOf.contractNo}`}
                    {c.previousContract && ` · ต่อสัญญาจาก ${c.previousContract.contractNo}`}
                  </p>
                  {c.commission && (
                    <p className="mt-1 text-xs text-blue-700">
                      ค่านายหน้า: สถานะ {c.commission.status} (ฐานคำนวณ ฿{formatMoney(c.commission.baseAmount)})
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {(c.status === "DRAFT" || c.status === "PENDING_SIGNATURE") && (
                    <button
                      type="button"
                      onClick={() => signMut.mutate(c.id)}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 font-medium text-white hover:bg-emerald-700"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> ลงนามสัญญา
                    </button>
                  )}
                  {(c.status === "DRAFT" || c.status === "ACTIVE") && (
                    <button
                      type="button"
                      onClick={() => setReviseTarget(c)}
                      className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 font-medium text-blue-700 hover:bg-blue-100"
                    >
                      <Edit3 className="h-3.5 w-3.5" />{" "}
                      {c.status === "ACTIVE" ? "แก้ไข (สร้าง Revision)" : "แก้ไขฉบับร่าง"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showConvertModal && <ConvertBookingContractModal onClose={() => setShowConvertModal(false)} />}
      {reviseTarget && <ReviseContractModal contract={reviseTarget} onClose={() => setReviseTarget(null)} />}
    </div>
  );
}
