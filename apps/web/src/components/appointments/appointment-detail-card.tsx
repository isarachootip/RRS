"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  APPOINTMENT_STATUS_COLORS,
  APPOINTMENT_STATUS_LABELS,
  type AppointmentStatusCode,
  type CalendarAppointmentItem,
  type CalendarViewMode,
  formatTimeShort,
} from "./appointments.types";

export function AppointmentsFilterBar({
  viewMode,
  onViewModeChange,
  onShiftDate,
  onToday,
  teamId,
  onTeamChange,
  agentId,
  onAgentChange,
  statusFilter,
  onStatusChange,
  teams,
  agents,
}: {
  viewMode: CalendarViewMode;
  onViewModeChange: (m: CalendarViewMode) => void;
  onShiftDate: (dir: -1 | 1) => void;
  onToday: () => void;
  teamId: string;
  onTeamChange: (v: string) => void;
  agentId: string;
  onAgentChange: (v: string) => void;
  statusFilter: string;
  onStatusChange: (v: string) => void;
  teams: Array<{ id: string; name: string }>;
  agents: Array<{ id: string; fullName: string }>;
}) {
  const selCls = "rounded-lg border border-slate-300 px-2.5 py-1.5";
  const navBtnCls = "rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-slate-200 p-0.5 text-xs">
          {(
            [
              ["day", "วัน"],
              ["week", "สัปดาห์"],
              ["month", "เดือน"],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => onViewModeChange(m)}
              className={`rounded-md px-3 py-1.5 font-medium ${
                viewMode === m ? "bg-blue-600 text-white" : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button type="button" aria-label="ช่วงก่อนหน้า" onClick={() => onShiftDate(-1)} className={navBtnCls}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onToday}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
          >
            วันนี้
          </button>
          <button type="button" aria-label="ช่วงถัดไป" onClick={() => onShiftDate(1)} className={navBtnCls}>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <select
          aria-label="กรองตามทีม"
          value={teamId}
          onChange={(e) => onTeamChange(e.target.value)}
          className={selCls}
        >
          <option value="">ทุกทีม</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select
          aria-label="กรองตาม Agent"
          value={agentId}
          onChange={(e) => onAgentChange(e.target.value)}
          className={selCls}
        >
          <option value="">Agent ทุกคน</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.fullName}
            </option>
          ))}
        </select>
        <select
          aria-label="กรองตามสถานะนัด"
          value={statusFilter}
          onChange={(e) => onStatusChange(e.target.value)}
          className={selCls}
        >
          <option value="">ทุกสถานะ</option>
          {(Object.keys(APPOINTMENT_STATUS_LABELS) as AppointmentStatusCode[]).map((st) => (
            <option key={st} value={st}>
              {APPOINTMENT_STATUS_LABELS[st]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export function SelectedAppointmentDetailCard({
  appt,
  onChangeStatus,
  onReschedule,
}: {
  appt: CalendarAppointmentItem;
  onChangeStatus: (status: AppointmentStatusCode) => void;
  onReschedule: () => void;
}) {
  const statusActions: Array<{ status: AppointmentStatusCode; label: string; cls: string }> = [
    ...(appt.status === "PENDING"
      ? [{ status: "CONFIRMED" as const, label: "ยืนยันนัด", cls: "bg-blue-600 text-white" }]
      : []),
    { status: "COMPLETED", label: "นัดสำเร็จ", cls: "bg-emerald-600 text-white" },
    { status: "NO_SHOW", label: "ลูกค้าไม่มา", cls: "border border-rose-200 bg-rose-50 text-rose-700" },
    { status: "CANCELLED", label: "ยกเลิกนัด", cls: "border border-slate-300 text-slate-700" },
  ];

  return (
    <div className="rounded-xl border border-blue-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-slate-900">{appt.code}</span>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${APPOINTMENT_STATUS_COLORS[appt.status]}`}
            >
              {APPOINTMENT_STATUS_LABELS[appt.status]}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-700">
            ลูกค้า: <span className="font-medium">{appt.lead?.fullName}</span> ({formatTimeShort(appt.startsAt)}–
            {formatTimeShort(appt.endsAt)})
          </p>
          {appt.rescheduledFrom && (
            <p className="mt-0.5 text-xs text-purple-700">เลื่อนมาจากนัดเดิม: {appt.rescheduledFrom.code}</p>
          )}
          {appt.location && <p className="mt-0.5 text-xs text-slate-600">สถานที่: {appt.location}</p>}
        </div>

        {(appt.status === "PENDING" || appt.status === "CONFIRMED") && (
          <div className="flex flex-wrap gap-2 text-xs">
            {statusActions.map((act) => (
              <button
                key={act.status}
                type="button"
                onClick={() => onChangeStatus(act.status)}
                className={`rounded-lg px-3 py-1.5 font-medium ${act.cls}`}
              >
                {act.label}
              </button>
            ))}
            <button
              type="button"
              onClick={onReschedule}
              className="rounded-lg border border-purple-300 bg-purple-50 px-3 py-1.5 font-medium text-purple-800"
            >
              เลื่อนนัด
            </button>
          </div>
        )}
      </div>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {appt.items.map((item) => (
          <div key={item.assetId} className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs">
            <div className="font-semibold text-slate-900">{item.asset.code}</div>
            <div className="text-slate-600">{`${item.asset.project?.name ?? "-"} ${item.asset.unitNo ? `(${item.asset.unitNo})` : ""}`}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
