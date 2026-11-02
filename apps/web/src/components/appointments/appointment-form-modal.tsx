"use client";

import { ApiError, api } from "@/lib/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, X } from "lucide-react";
import { useState } from "react";
import { type CalendarAppointmentItem, type OverlapItem, formatTimeShort } from "./appointments.types";

interface AppointmentFormModalProps {
  rescheduleTarget?: CalendarAppointmentItem | null;
  defaultLeadId?: string;
  onClose: () => void;
}

export function AppointmentFormModal({ rescheduleTarget, defaultLeadId, onClose }: AppointmentFormModalProps) {
  const qc = useQueryClient();
  const isReschedule = Boolean(rescheduleTarget);

  const [form, setForm] = useState({
    leadId: rescheduleTarget?.leadId ?? defaultLeadId ?? "",
    startsAt: rescheduleTarget ? rescheduleTarget.startsAt.slice(0, 16) : "2026-11-15T10:00",
    endsAt: rescheduleTarget ? rescheduleTarget.endsAt.slice(0, 16) : "2026-11-15T11:30",
    location: rescheduleTarget?.location ?? "",
    agentId: rescheduleTarget?.agentId ?? "",
    coordinatorName: rescheduleTarget?.coordinatorName ?? "",
    coordinatorPhone: rescheduleTarget?.coordinatorPhone ?? "",
    note: rescheduleTarget?.note ?? "",
  });
  const [selectedAssets, setSelectedAssets] = useState<string[]>(
    rescheduleTarget ? rescheduleTarget.items.map((i) => i.assetId) : [],
  );
  const [overlaps, setOverlaps] = useState<OverlapItem[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: leadsData } = useQuery({
    queryKey: ["leads", "options"],
    queryFn: () => api<{ items: Array<{ id: string; code: string; fullName: string }> }>("/api/v1/leads?pageSize=50"),
    enabled: !isReschedule,
  });
  const { data: assetsData } = useQuery({
    queryKey: ["assets", "options"],
    queryFn: () =>
      api<{ items: Array<{ id: string; code: string; unitNo: string | null; project?: { name: string } | null }> }>(
        "/api/v1/assets?pageSize=50",
      ),
  });
  const { data: agentsData } = useQuery({
    queryKey: ["agents", "options"],
    queryFn: () => api<{ items: Array<{ id: string; fullName: string }> }>("/api/v1/agents"),
  });

  const setField = (key: keyof typeof form, value: string) => setForm((prev) => ({ ...prev, [key]: value }));
  const toggleAsset = (id: string) =>
    setSelectedAssets((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const submitForm = async (confirmOverlap = false) => {
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const payload = {
        ...(isReschedule ? {} : { leadId: form.leadId }),
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: new Date(form.endsAt).toISOString(),
        location: form.location || null,
        ...(form.agentId ? { agentId: form.agentId } : {}),
        coordinatorName: form.coordinatorName || null,
        coordinatorPhone: form.coordinatorPhone || null,
        note: form.note || null,
        assetIds: selectedAssets,
        confirmOverlap,
      };
      const url =
        isReschedule && rescheduleTarget
          ? `/api/v1/appointments/${rescheduleTarget.id}/reschedule`
          : "/api/v1/appointments";
      await api(url, { method: "POST", body: JSON.stringify(payload) });
      await qc.invalidateQueries({ queryKey: ["appointments"] });
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.code === "APPOINTMENT_OVERLAP_WARNING") {
        setOverlaps((err.details as { overlaps?: OverlapItem[] } | undefined)?.overlaps ?? []);
        setErrorMsg(err.message);
      } else {
        setErrorMsg(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการบันทึกนัดหมาย");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const inpCls = "w-full rounded-lg border border-slate-300 px-3 py-2";
  const lblCls = "mb-1 block font-medium text-slate-700";
  const textFields: Array<{ key: keyof typeof form; label: string; aria?: string; type?: string }> = [
    { key: "startsAt", label: "วันและเวลาเริ่ม *", aria: "วันและเวลาเริ่ม", type: "datetime-local" },
    { key: "endsAt", label: "วันและเวลาสิ้นสุด *", aria: "วันและเวลาสิ้นสุด", type: "datetime-local" },
    { key: "location", label: "สถานที่นัดพบ", aria: "สถานที่นัดพบ" },
    { key: "coordinatorName", label: "ผู้ประสานงาน / เจ้าของห้อง" },
    { key: "coordinatorPhone", label: "เบอร์โทรผู้ประสานงาน" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            {isReschedule ? `เลื่อนนัดหมาย ${rescheduleTarget?.code ?? ""}` : "สร้างนัดดูห้องใหม่"}
          </h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 text-sm">
          {!isReschedule && (
            <div>
              <label className={lblCls}>ลูกค้าที่นัดดู *</label>
              <select
                aria-label="ลูกค้าที่นัดดู"
                value={form.leadId}
                onChange={(e) => setField("leadId", e.target.value)}
                className={inpCls}
              >
                <option value="">-- เลือกลูกค้า --</option>
                {(leadsData?.items ?? []).map((l) => (
                  <option key={l.id} value={l.id}>{`${l.code} · ${l.fullName}`}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {textFields.map((f) => (
              <div key={f.key}>
                <label className={lblCls}>{f.label}</label>
                <input
                  type={f.type ?? "text"}
                  aria-label={f.aria ?? f.label}
                  value={form[f.key]}
                  onChange={(e) => setField(f.key, e.target.value)}
                  className={inpCls}
                />
              </div>
            ))}
            <div>
              <label className={lblCls}>Agent ผู้พาลูกค้าดูห้อง</label>
              <select
                aria-label="Agent ผู้พาลูกค้าดูห้อง"
                value={form.agentId}
                onChange={(e) => setField("agentId", e.target.value)}
                className={inpCls}
              >
                <option value="">ตัวเอง (ค่าเริ่มต้น)</option>
                {(agentsData?.items ?? []).map((ag) => (
                  <option key={ag.id} value={ag.id}>
                    {ag.fullName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={lblCls}>เลือกห้องที่นัดดู ({selectedAssets.length} ห้อง) *</label>
            <div className="max-h-36 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
              {(assetsData?.items ?? []).map((a) => (
                <label
                  key={a.id}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedAssets.includes(a.id)}
                    onChange={() => toggleAsset(a.id)}
                    className="h-4 w-4 rounded"
                  />
                  <span className="font-medium text-slate-800">{a.code}</span>
                  <span className="text-slate-600">{`${a.project?.name ?? ""} ${a.unitNo ? `(${a.unitNo})` : ""}`}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className={lblCls}>หมายเหตุ</label>
            <textarea
              rows={2}
              value={form.note}
              onChange={(e) => setField("note", e.target.value)}
              className={inpCls}
            />
          </div>

          {overlaps.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span>พบการนัดหมายซ้อนของ Agent คนเดียวกัน ({overlaps.length} รายการ)</span>
              </div>
              <ul className="mt-1 list-inside list-disc text-xs">
                {overlaps.map((ov) => (
                  <li key={ov.id}>{`${ov.code} (${formatTimeShort(ov.startsAt)}–${formatTimeShort(ov.endsAt)})`}</li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => void submitForm(true)}
                disabled={submitting}
                className="mt-2 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white"
              >
                ยืนยันบันทึกนัดซ้อน
              </button>
            </div>
          )}

          {errorMsg && overlaps.length === 0 && (
            <div className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{errorMsg}</div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={() => void submitForm(false)}
              disabled={submitting || selectedAssets.length === 0 || (!isReschedule && !form.leadId)}
              className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-50"
            >
              {submitting ? "กำลังบันทึก..." : isReschedule ? "บันทึกการเลื่อนนัด" : "บันทึกนัดดูห้อง"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
