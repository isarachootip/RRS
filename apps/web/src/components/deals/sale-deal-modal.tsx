"use client";

import { api, ApiError } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useState } from "react";

const inpCls = "w-full rounded-lg border border-slate-300 px-3 py-2 text-xs";

export function CreateSaleDealModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [leadId, setLeadId] = useState("");
  const [assetId, setAssetId] = useState("");
  const [askingPrice, setAskingPrice] = useState("8500000");
  const [offeredPrice, setOfferedPrice] = useState("8200000");
  const [err, setErr] = useState<string | null>(null);

  const { data: leadsData } = useQuery({
    queryKey: ["leads", "sale-options"],
    queryFn: () => api<{ items: Array<{ id: string; code: string; fullName: string }> }>("/api/v1/leads?pageSize=100"),
  });
  const { data: assetsData } = useQuery({
    queryKey: ["assets", "sale-options"],
    queryFn: () =>
      api<{ items: Array<{ id: string; code: string; unitNo: string | null }> }>("/api/v1/assets?pageSize=100"),
  });

  const createMut = useMutation({
    mutationFn: () =>
      api("/api/v1/sale-deals", {
        method: "POST",
        body: JSON.stringify({
          leadId,
          assetId,
          stage: "OFFERED",
          askingPrice: Number(askingPrice),
          offeredPrice: Number(offeredPrice),
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sale-deals"] });
      onClose();
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : "สร้างดีลขายไม่สำเร็จ"),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h2 className="text-base font-bold text-slate-900">สร้างดีลขายใหม่ (Sale Deal)</h2>
          <button type="button" aria-label="ปิด" onClick={onClose} className="rounded p-1 hover:bg-slate-100">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            createMut.mutate();
          }}
        >
          {err && <div className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{err}</div>}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">ผู้ซื้อ (Lead) *</label>
            <select
              aria-label="เลือกผู้ซื้อ"
              required
              value={leadId}
              onChange={(e) => setLeadId(e.target.value)}
              className={inpCls}
            >
              <option value="">-- เลือกผู้ซื้อ --</option>
              {(leadsData?.items ?? []).map((l) => (
                <option key={l.id} value={l.id}>{`${l.code} · ${l.fullName}`}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">ทรัพย์สินที่ขาย *</label>
            <select
              aria-label="เลือกทรัพย์สินที่ขาย"
              required
              value={assetId}
              onChange={(e) => setAssetId(e.target.value)}
              className={inpCls}
            >
              <option value="">-- เลือกทรัพย์สิน --</option>
              {(assetsData?.items ?? []).map((a) => (
                <option key={a.id} value={a.id}>{`${a.code} ${a.unitNo ? `(${a.unitNo})` : ""}`}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">ราคาตั้งขาย (บาท)</label>
              <input
                type="number"
                aria-label="ราคาตั้งขาย"
                value={askingPrice}
                onChange={(e) => setAskingPrice(e.target.value)}
                className={inpCls}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">ราคาที่ลูกค้าเสนอ (บาท)</label>
              <input
                type="number"
                aria-label="ราคาที่ลูกค้าเสนอ"
                value={offeredPrice}
                onChange={(e) => setOfferedPrice(e.target.value)}
                className={inpCls}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-xs">
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={createMut.isPending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white"
            >
              บันทึกดีลขาย
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
