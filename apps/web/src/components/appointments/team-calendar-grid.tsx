"use client";

import { Building2, Clock, Lock, MapPin, User } from "lucide-react";
import {
  APPOINTMENT_STATUS_COLORS,
  APPOINTMENT_STATUS_LABELS,
  type CalendarAppointmentItem,
  type CalendarViewMode,
  formatTimeShort,
  isSameLocalDate,
} from "./appointments.types";

interface TeamCalendarGridProps {
  days: Date[];
  mode: CalendarViewMode;
  items: CalendarAppointmentItem[];
  selectedId: string | null;
  onSelect: (item: CalendarAppointmentItem) => void;
}

export function TeamCalendarGrid({ days, mode, items, selectedId, onSelect }: TeamCalendarGridProps) {
  const gridClass =
    mode === "day"
      ? "grid-cols-1"
      : mode === "week"
        ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-7"
        : "grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7";

  return (
    <div data-testid="team-calendar" data-view-mode={mode} className={`grid gap-3 ${gridClass}`}>
      {days.map((day) => {
        const dayItems = items.filter((item) => isSameLocalDate(new Date(item.startsAt), day));
        const isToday = isSameLocalDate(day, new Date());

        return (
          <div
            key={day.toISOString()}
            className={`min-h-[140px] rounded-xl border p-3 transition ${
              isToday ? "border-blue-300 bg-blue-50/20" : "border-slate-200 bg-white"
            }`}
          >
            <div className="mb-2 flex items-center justify-between border-b border-slate-100 pb-1.5">
              <span className={`text-xs font-semibold ${isToday ? "text-blue-700" : "text-slate-700"}`}>
                {day.toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short" })}
              </span>
              {dayItems.length > 0 && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                  {dayItems.length} นัด
                </span>
              )}
            </div>

            {dayItems.length === 0 ? (
              <p className="py-4 text-center text-xs text-slate-400">ไม่มีนัดหมาย</p>
            ) : (
              <div className="space-y-2">
                {dayItems.map((appt) => {
                  if (appt.isBusyOnly) {
                    return (
                      <div
                        key={appt.id}
                        data-testid="busy-slot"
                        className="rounded-lg border border-slate-200 bg-slate-100 p-2 text-xs text-slate-600"
                      >
                        <div className="flex items-center gap-1 font-medium text-slate-700">
                          <Lock className="h-3.5 w-3.5 text-slate-500" />
                          <span>ไม่ว่าง</span>
                        </div>
                        <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
                          <Clock className="h-3 w-3" />
                          <span>{`${formatTimeShort(appt.startsAt)}–${formatTimeShort(appt.endsAt)}`}</span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500">
                          <User className="h-3 w-3" />
                          <span>{appt.agent.fullName}</span>
                        </div>
                      </div>
                    );
                  }

                  const selected = selectedId === appt.id;
                  return (
                    <button
                      key={appt.id}
                      type="button"
                      onClick={() => onSelect(appt)}
                      className={`w-full rounded-lg border p-2 text-left text-xs transition ${
                        selected
                          ? "border-blue-500 bg-blue-50/70 ring-1 ring-blue-500"
                          : "border-slate-200 bg-white hover:border-blue-300"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold text-slate-900">{appt.code}</span>
                        <span
                          className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${
                            APPOINTMENT_STATUS_COLORS[appt.status]
                          }`}
                        >
                          {APPOINTMENT_STATUS_LABELS[appt.status]}
                        </span>
                      </div>
                      <p className="mt-1 truncate font-medium text-slate-800">{appt.lead?.fullName ?? "-"}</p>
                      <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-600">
                        <Clock className="h-3 w-3 shrink-0" />
                        <span>{`${formatTimeShort(appt.startsAt)}–${formatTimeShort(appt.endsAt)}`}</span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-600">
                        <Building2 className="h-3 w-3 shrink-0" />
                        <span>{appt.items.length} ห้อง</span>
                      </div>
                      {appt.location && (
                        <div className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-slate-500">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{appt.location}</span>
                        </div>
                      )}
                      <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500">
                        <User className="h-3 w-3 shrink-0" />
                        <span className="truncate">{appt.agent.fullName}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
