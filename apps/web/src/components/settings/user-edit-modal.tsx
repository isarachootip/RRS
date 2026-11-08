"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { ApiError, api } from "@/lib/api";
import type { AdminRoleItem, AdminTeamItem, AdminUserItem } from "./types";

interface UserEditModalProps {
  user: AdminUserItem;
  teams: AdminTeamItem[];
  roles: AdminRoleItem[];
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export function UserEditModal({ user, teams, roles, onClose, onSuccess }: UserEditModalProps) {
  const qc = useQueryClient();
  const [fullName, setFullName] = useState(user.fullName);
  const [email, setEmail] = useState(user.email);
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [teamId, setTeamId] = useState(user.teamId ?? "");
  const [roleId, setRoleId] = useState(user.roles[0]?.id ?? roles[0]?.id ?? "");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const updateMutation = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {
        fullName: fullName.trim(),
        email: email.trim(),
        teamId: teamId || null,
        roleIds: [roleId || roles[0]?.id],
      };
      if (password.trim()) {
        payload.password = password.trim();
      }
      return api(`/api/v1/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-users"] });
      onSuccess(
        password.trim()
          ? `บันทึกข้อมูลและตั้งรหัสผ่านใหม่ให้ "${fullName}" เรียบร้อยแล้ว`
          : `บันทึกข้อมูลของ "${fullName}" เรียบร้อยแล้ว`,
      );
      onClose();
    },
    onError: (err) => setErrorMsg(err instanceof ApiError ? err.message : "บันทึกการแก้ไขไม่สำเร็จ"),
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    updateMutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-line bg-surface p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-ink">แก้ไขผู้ใช้ / ตั้งรหัสผ่านใหม่</h3>
          <button type="button" onClick={onClose} className="text-sm text-ink-muted hover:text-ink">
            ✕
          </button>
        </div>

        {errorMsg && (
          <div role="alert" className="mb-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-sm">
          <div>
            <label htmlFor="edit-fullname" className="mb-1 block text-xs font-medium text-ink">
              ชื่อ-นามสกุล
            </label>
            <input
              id="edit-fullname"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="h-9 w-full rounded border border-line px-3 text-sm"
            />
          </div>

          <div>
            <label htmlFor="edit-email" className="mb-1 block text-xs font-medium text-ink">
              ชื่อผู้ใช้ / อีเมล
            </label>
            <input
              id="edit-email"
              type="text"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-9 w-full rounded border border-line px-3 text-sm"
            />
          </div>

          <div>
            <label htmlFor="edit-password" className="mb-1 block text-xs font-medium text-ink">
              รหัสผ่านใหม่ <span className="font-normal text-ink-muted">(เว้นว่างได้หากไม่ต้องการเปลี่ยน)</span>
            </label>
            <div className="flex gap-2">
              <input
                id="edit-password"
                type={showPw ? "text" : "password"}
                minLength={6}
                placeholder="ตั้งรหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-9 flex-1 rounded border border-line px-3 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="h-9 rounded border border-line px-2.5 text-xs text-ink-muted hover:bg-paper"
              >
                {showPw ? "ซ่อน" : "ดูรหัส"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="edit-team" className="mb-1 block text-xs font-medium text-ink">
                ทีม
              </label>
              <select
                id="edit-team"
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                className="h-9 w-full rounded border border-line px-2 text-sm"
              >
                <option value="">ไม่สังกัดทีม</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="edit-role" className="mb-1 block text-xs font-medium text-ink">
                บทบาท
              </label>
              <select
                id="edit-role"
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
                className="h-9 w-full rounded border border-line px-2 text-sm"
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded border border-line px-4 text-xs font-medium hover:bg-paper"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="h-9 rounded bg-lagoon px-4 text-xs font-medium text-white hover:bg-lagoon-deep disabled:opacity-50"
            >
              {updateMutation.isPending ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
