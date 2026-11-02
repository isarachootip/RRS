"use client";

import { api } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, Plus } from "lucide-react";
import { useState } from "react";
import { AppointmentsFilterBar, SelectedAppointmentDetailCard } from "./appointment-detail-card";
import { AppointmentFormModal } from "./appointment-form-modal";
import {
  type AppointmentStatusCode,
  type CalendarAppointmentItem,
  type CalendarViewMode,
  getViewDateRange,
} from "./appointments.types";
import { TeamCalendarGrid } from "./team-calendar-grid";

export function AppointmentsView() {
  const qc = useQueryClient();
  const [viewMode, setViewMode] = useState<CalendarViewMode>("week");
  const [anchorDate, setAnchorDate] = useState<Date>(() => new Date());
  const [teamId, setTeamId] = useState("");
  const [agentId, setAgentId] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState<CalendarAppointmentItem | null>(null);

  const { from, to, days } = getViewDateRange(anchorDate, viewMode);
  const params = new URLSearchParams({
    from: from.toISOString(),
    to: to.toISOString(),
    ...(teamId ? { teamId } : {}),
    ...(agentId ? { agentId } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
  });

  const { data: calData, isLoading } = useQuery({
    queryKey: ["appointments", "calendar", params.toString()],
    queryFn: () => api<{ items: CalendarAppointmentItem[] }>(`/api/v1/appointments/calendar?${params.toString()}`),
  });
  const { data: agentsData } = useQuery({
    queryKey: ["agents", "options"],
    queryFn: () => api<{ items: Array<{ id: string; fullName: string; teamId: string | null }> }>("/api/v1/agents"),
  });
  const { data: teamsData } = useQuery({
    queryKey: ["teams", "options"],
    queryFn: () => api<{ items: Array<{ id: string; name: string }> }>("/api/v1/teams-options"),
  });

  const statusMut = useMutation({
    mutationFn: (vars: { id: string; status: AppointmentStatusCode }) =>
      api(`/api/v1/appointments/${vars.id}/status`, { method: "PATCH", body: JSON.stringify({ status: vars.status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["appointments"] }),
  });

  const shiftDate = (dir: -1 | 1) => {
    const next = new Date(anchorDate);
    if (viewMode === "day") next.setDate(next.getDate() + dir);
    else if (viewMode === "week") next.setDate(next.getDate() + dir * 7);
    else next.setMonth(next.getMonth() + dir);
    setAnchorDate(next);
  };

  const items = calData?.items ?? [];
  const selectedAppt = items.find((i) => i.id === selectedId && !i.isBusyOnly) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <Calendar className="h-6 w-6 text-blue-600" />
            นัดดูห้อง & ปฏิทินทีม
          </h1>
          <p className="text-sm text-slate-600">จัดการตารางนัดดูห้องหลายรายการ ตรวจนัดซ้อน และดูปฏิทินรวมของทีม</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" /> สร้างนัดดูห้อง
        </button>
      </div>

      <AppointmentsFilterBar
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onShiftDate={shiftDate}
        onToday={() => setAnchorDate(new Date())}
        teamId={teamId}
        onTeamChange={setTeamId}
        agentId={agentId}
        onAgentChange={setAgentId}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        teams={teamsData?.items ?? []}
        agents={agentsData?.items ?? []}
      />

      {isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          กำลังโหลดปฏิทินนัดหมาย...
        </div>
      ) : (
        <TeamCalendarGrid
          days={days}
          mode={viewMode}
          items={items}
          selectedId={selectedId}
          onSelect={(item) => setSelectedId(item.id)}
        />
      )}

      {selectedAppt && (
        <SelectedAppointmentDetailCard
          appt={selectedAppt}
          onChangeStatus={(status) => statusMut.mutate({ id: selectedAppt.id, status })}
          onReschedule={() => setRescheduleTarget(selectedAppt)}
        />
      )}

      {(showCreateModal || rescheduleTarget) && (
        <AppointmentFormModal
          rescheduleTarget={rescheduleTarget}
          onClose={() => {
            setShowCreateModal(false);
            setRescheduleTarget(null);
          }}
        />
      )}
    </div>
  );
}
