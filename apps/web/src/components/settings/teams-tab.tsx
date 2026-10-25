"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { api } from "@/lib/api";
import type { AdminTeamItem, AdminUserItem } from "./types";

interface TeamsTabProps {
  teams: AdminTeamItem[];
  users: AdminUserItem[];
}

export function TeamsTab({ teams, users }: TeamsTabProps) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [managerId, setManagerId] = useState("");

  const createTeam = useMutation({
    mutationFn: () =>
      api("/api/v1/teams", {
        method: "POST",
        body: JSON.stringify({ name, managerId: managerId || null }),
      }),
    onSuccess: () => {
      setName("");
      setManagerId("");
      void qc.invalidateQueries({ queryKey: ["admin-teams"] });
    },
  });

  const updateManager = useMutation({
    mutationFn: (payload: { id: string; managerId: string | null }) =>
      api(`/api/v1/teams/${payload.id}`, {
        method: "PATCH",
        body: JSON.stringify({ managerId: payload.managerId }),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin-teams"] }),
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    createTeam.mutate();
  };

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="min-w-full divide-y divide-line text-sm">
          <thead className="bg-paper text-left font-medium text-ink-muted">
            <tr>
              <th className="px-4 py-3">ชื่อทีม</th>
              <th className="px-4 py-3">ผู้จัดการทีม</th>
              <th className="px-4 py-3">จำนวนสมาชิก</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {teams.map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-3 font-medium text-ink">{t.name}</td>
                <td className="px-4 py-3">
                  <select
                    aria-label={`ผู้จัดการทีม ${t.name}`}
                    value={t.managerId ?? ""}
                    onChange={(e) => updateManager.mutate({ id: t.id, managerId: e.target.value || null })}
                    className="h-8 rounded border border-line px-2 text-xs"
                  >
                    <option value="">- ไม่ระบุ -</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">{t.memberCount} คน</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-wrap gap-3 rounded-lg border border-line bg-surface p-4">
        <input
          type="text"
          required
          placeholder="ชื่อทีมใหม่"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-9 flex-1 rounded border border-line px-3 text-sm"
        />
        <select
          aria-label="ผู้จัดการทีมใหม่"
          value={managerId}
          onChange={(e) => setManagerId(e.target.value)}
          className="h-9 rounded border border-line px-2 text-sm"
        >
          <option value="">เลือกผู้จัดการทีม (ถ้ามี)</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.fullName}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={createTeam.isPending}
          className="h-9 rounded bg-lagoon px-4 text-sm font-medium text-white hover:bg-lagoon-deep"
        >
          สร้างทีม
        </button>
      </form>
    </div>
  );
}
