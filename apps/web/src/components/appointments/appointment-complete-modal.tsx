"use client";

import { api, ApiError } from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, X } from "lucide-react";
import { useState } from "react";
import { type CalendarAppointmentItem, FOLLOW_UP_OUTCOME_LABELS, type FollowUpOutcomeCode } from "./appointments.types";

const OUTCOME_KEYS = Object.keys(FOLLOW_UP_OUTCOME_LABELS) as FollowUpOutcomeCode[];

export function AppointmentCompleteModal({ appt, onClose }: { appt: CalendarAppointmentItem; onClose: () => void }) {
  const qc = useQueryClient();
  const [outcomes, setOutcomes] = useState<Record<string, { outcome: FollowUpOutcomeCode; outcomeNote: string }>>(() =>
    Object.fromEntries(
      appt.items.map((item) => [
        item.assetId,
        {
          outcome: (item.outcome as FollowUpOutcomeCode | null) ?? "CONSIDERING",
          outcomeNote: item.outcomeNote ?? "",
        },
      ]),
    ),
  );
  const [nextFollowUpAt, setNextFollowUpAt] = useState(() => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    tomorrow.setMinutes(0, 0, 0);
    return tomorrow.toISOString().slice(0, 16);
  });
  const [note, setNote] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const completeMut = useMutation({
    mutationFn: () =>
      api(`/api/v1/appointments/${appt.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "COMPLETED",
          nextFollowUpAt: new Date(nextFollowUpAt).toISOString(),
          note: note.trim() || null,
          outcomes: appt.items.map((item) => ({
            assetId: item.assetId,
            outcome: outcomes[item.assetId]?.outcome ?? "CONSIDERING",
            outcomeNote: outcomes[item.assetId]?.outcomeNote.trim() || null,
          })),
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments"] });
      onClose();
    },
    onError: (err) => {
      setErrorMsg(err instanceof ApiError ? err.message : "บันทึกผลติดตามไม่สำเร็จ");
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            บันทึกผลติดตามหลังนัดดูห้อง ({appt.code})
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
            completeMut.mutate();
          }}
        >
          {errorMsg && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{errorMsg}</div>
          )}

          <div className="space-y-3">
            <div className="text-xs font-semibold text-slate-700">ผลของลูกค้าต่อแต่ละห้องที่เข้าชม *</div>
            {appt.items.map((item) => {
              const current = outcomes[item.assetId] ?? { outcome: "CONSIDERING", outcomeNote: "" };
              return (
                <div key={item.assetId} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-2 text-xs font-bold text-slate-900">
                    {item.asset.code} · {item.asset.project?.name ?? "-"}{" "}
                    {item.asset.unitNo ? `(${item.asset.unitNo})` : ""}
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-slate-600">ผลการพิจารณา *</label>
                      <select
                        aria-label={`ผลของห้อง ${item.asset.code}`}
                        value={current.outcome}
                        onChange={(e) =>
                          setOutcomes((prev) => ({
                            ...prev,
                            [item.assetId]: { ...current, outcome: e.target.value as FollowUpOutcomeCode },
                          }))
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                      >
                        {OUTCOME_KEYS.map((k) => (
                          <option key={k} value={k}>
                            {FOLLOW_UP_OUTCOME_LABELS[k]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-slate-600">หมายเหตุรายห้อง</label>
                      <input
                        type="text"
                        placeholder="เช่น ขอต่อราคาเหลือ 23,000 / ชอบชั้นสูง"
                        value={current.outcomeNote}
                        onChange={(e) =>
                          setOutcomes((prev) => ({
                            ...prev,
                            [item.assetId]: { ...current, outcomeNote: e.target.value },
                          }))
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">วันและเวลาติดตามครั้งถัดไป *</label>
              <input
                type="datetime-local"
                aria-label="วันและเวลาติดตามครั้งถัดไป"
                required
                value={nextFollowUpAt}
                onChange={(e) => setNextFollowUpAt(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">สรุปภาพรวมการนัดชม</label>
              <input
                type="text"
                placeholder="บันทึกเพิ่มเติมสำหรับทีม..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={completeMut.isPending}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {completeMut.isPending ? "กำลังบันทึก..." : "ยืนยันนัดสำเร็จและบันทึกผล"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
