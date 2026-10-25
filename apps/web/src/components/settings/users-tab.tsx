"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { ApiError, api } from "@/lib/api";
import type { AdminRoleItem, AdminTeamItem, AdminUserItem } from "./types";

interface UsersTabProps {
  users: AdminUserItem[];
  teams: AdminTeamItem[];
  roles: AdminRoleItem[];
}

export function UsersTab({ users, teams, roles }: UsersTabProps) {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [teamId, setTeamId] = useState("");
  const [roleId, setRoleId] = useState(roles[0]?.id ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () =>
      api("/api/v1/users", {
        method: "POST",
        body: JSON.stringify({
          email,
          fullName,
          password,
          teamId: teamId || null,
          roleIds: [roleId || roles[0]?.id],
        }),
      }),
    onSuccess: () => {
      setEmail("");
      setFullName("");
      setPassword("");
      setErrorMsg(null);
      setMessage("เพิ่มผู้ใช้ใหม่เรียบร้อยแล้ว");
      void qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (err) => setErrorMsg(err instanceof ApiError ? err.message : "เพิ่มผู้ใช้ไม่สำเร็จ"),
  });

  const toggleActive = useMutation({
    mutationFn: (u: AdminUserItem) =>
      api(`/api/v1/users/${u.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !u.isActive }),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const resetMfa = useMutation({
    mutationFn: (id: string) => api(`/api/v1/users/${id}/reset-mfa`, { method: "POST" }),
    onSuccess: () => {
      setMessage("รีเซ็ต 2FA เรียบร้อยแล้ว");
      void qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    createMutation.mutate();
  };

  return (
    <div className="space-y-6">
      {message && (
        <div role="status" className="rounded-md border border-lagoon/30 bg-paper px-4 py-2 text-sm text-lagoon-deep">
          {message}
        </div>
      )}
      {errorMsg && (
        <div role="alert" className="rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="min-w-full divide-y divide-line text-sm">
          <thead className="bg-paper text-left font-medium text-ink-muted">
            <tr>
              <th className="px-4 py-3">ชื่อ-นามสกุล</th>
              <th className="px-4 py-3">อีเมล</th>
              <th className="px-4 py-3">ทีม</th>
              <th className="px-4 py-3">บทบาท</th>
              <th className="px-4 py-3">2FA</th>
              <th className="px-4 py-3">สถานะ</th>
              <th className="px-4 py-3">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3 font-medium text-ink">{u.fullName}</td>
                <td className="px-4 py-3 text-ink-muted">{u.email}</td>
                <td className="px-4 py-3">{u.teamName ?? "-"}</td>
                <td className="px-4 py-3">{u.roles.map((r) => r.name).join(", ")}</td>
                <td className="px-4 py-3">{u.totpEnabled ? "เปิดแล้ว" : "ยังไม่เปิด"}</td>
                <td className="px-4 py-3">{u.isActive ? "ใช้งาน" : "ปิดใช้งาน"}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => toggleActive.mutate(u)}
                      className="rounded border border-line px-2.5 py-1 text-xs hover:bg-paper"
                    >
                      {u.isActive ? "ปิดบัญชี" : "เปิดบัญชี"}
                    </button>
                    {u.totpEnabled && (
                      <button
                        type="button"
                        onClick={() => resetMfa.mutate(u.id)}
                        className="rounded border border-line px-2.5 py-1 text-xs hover:bg-paper"
                      >
                        รีเซ็ต 2FA
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-3 rounded-lg border border-line bg-surface p-4 md:grid-cols-5">
        <input
          type="text"
          required
          placeholder="ชื่อ-นามสกุล"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="h-9 rounded border border-line px-3 text-sm"
        />
        <input
          type="email"
          required
          placeholder="อีเมล"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-9 rounded border border-line px-3 text-sm"
        />
        <input
          type="password"
          required
          placeholder="รหัสผ่าน (อย่างน้อย 10 ตัว)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-9 rounded border border-line px-3 text-sm"
        />
        <select
          aria-label="เลือกทีม"
          value={teamId}
          onChange={(e) => setTeamId(e.target.value)}
          className="h-9 rounded border border-line px-2 text-sm"
        >
          <option value="">ไม่สังกัดทีม</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <select
            aria-label="เลือกบทบาท"
            value={roleId || roles[0]?.id || ""}
            onChange={(e) => setRoleId(e.target.value)}
            className="h-9 flex-1 rounded border border-line px-2 text-sm"
          >
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="h-9 rounded bg-lagoon px-4 text-sm font-medium text-white hover:bg-lagoon-deep"
          >
            เพิ่มผู้ใช้
          </button>
        </div>
      </form>
    </div>
  );
}
