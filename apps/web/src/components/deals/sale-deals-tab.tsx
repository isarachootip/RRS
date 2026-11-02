"use client";

import { api } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Home, Plus } from "lucide-react";
import { useState } from "react";
import { formatMoney, formatThaiDate } from "../bookings/bookings.types";
import {
  FEE_PAYER_LABELS,
  type FeePayerCode,
  SALE_STAGE_COLORS,
  SALE_STAGE_LABELS,
  type SaleDealItem,
  type SaleStageCode,
} from "./deals.types";
import { CreateSaleDealModal } from "./sale-deal-modal";

const STAGE_KEYS = Object.keys(SALE_STAGE_LABELS) as SaleStageCode[];
const FEE_PAYERS = Object.keys(FEE_PAYER_LABELS) as FeePayerCode[];

export function SaleDealsTab() {
  const qc = useQueryClient();
  const [stageFilter, setStageFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const queryStr = stageFilter ? `?stage=${stageFilter}` : "";
  const { data: deals, isLoading } = useQuery({
    queryKey: ["sale-deals", stageFilter],
    queryFn: () => api<SaleDealItem[]>(`/api/v1/sale-deals${queryStr}`),
  });

  const updateMut = useMutation({
    mutationFn: (vars: { id: string; stage?: SaleStageCode; transferFeePayer?: FeePayerCode }) =>
      api(`/api/v1/sale-deals/${vars.id}`, { method: "PATCH", body: JSON.stringify(vars) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sale-deals"] });
      qc.invalidateQueries({ queryKey: ["assets"] });
    },
  });

  const items = deals ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => setStageFilter("")}
            className={`rounded-lg px-3 py-1.5 font-medium ${stageFilter === "" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`}
          >
            ทั้งหมด ({items.length})
          </button>
          {STAGE_KEYS.map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStageFilter(st)}
              className={`rounded-lg px-3 py-1.5 font-medium ${stageFilter === st ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`}
            >
              {SALE_STAGE_LABELS[st]}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-medium text-white"
        >
          <Plus className="h-4 w-4" /> สร้างดีลขาย
        </button>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          กำลังโหลดดีลขาย...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          ยังไม่มีรายการดีลขาย
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {items.map((d) => (
            <div
              key={d.id}
              data-testid={`sale-deal-card-${d.code}`}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Home className="h-4 w-4 text-blue-600" />
                    <span className="text-base font-bold text-slate-900">{d.code}</span>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${SALE_STAGE_COLORS[d.stage]}`}
                    >
                      {SALE_STAGE_LABELS[d.stage]}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-800">
                    ผู้ซื้อ: <span className="font-semibold">{d.lead.fullName}</span> · ทรัพย์สิน:{" "}
                    <span className="font-semibold">{d.asset.code}</span> · ราคาตกลง:{" "}
                    <span className="font-bold text-emerald-700">
                      ฿{formatMoney(d.agreedPrice ?? d.offeredPrice ?? d.askingPrice)}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-slate-600">
                    {d.transferDate ? `วันนัดโอน: ${formatThaiDate(d.transferDate)} · ` : ""}
                    ค่าธรรมเนียมโอน: {d.transferFeePayer ? FEE_PAYER_LABELS[d.transferFeePayer] : "ยังไม่ระบุ"}
                    {d.loanBank ? ` · สินเชื่อ: ${d.loanBank}` : ""}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <select
                    aria-label={`เปลี่ยนสถานะดีล ${d.code}`}
                    value={d.stage}
                    onChange={(e) => updateMut.mutate({ id: d.id, stage: e.target.value as SaleStageCode })}
                    className="rounded-lg border border-slate-300 px-2.5 py-1.5"
                  >
                    {STAGE_KEYS.filter((k) => k !== "CANCELLED").map((st) => (
                      <option key={st} value={st}>
                        {SALE_STAGE_LABELS[st]}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label={`ค่าธรรมเนียมโอน ${d.code}`}
                    value={d.transferFeePayer ?? ""}
                    onChange={(e) => updateMut.mutate({ id: d.id, transferFeePayer: e.target.value as FeePayerCode })}
                    className="rounded-lg border border-slate-300 px-2.5 py-1.5"
                  >
                    <option value="">-- ค่าธรรมเนียมโอน --</option>
                    {FEE_PAYERS.map((fp) => (
                      <option key={fp} value={fp}>
                        {FEE_PAYER_LABELS[fp]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && <CreateSaleDealModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
