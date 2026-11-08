"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useEffect, useState } from "react";
import { ApiError, api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { AdminUserItem } from "./types";

interface MfaSetupResponse {
  secret: string;
  qrDataUrl: string;
}

export function MfaSettingsCard({ users }: { users: AdminUserItem[] }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const matchedUser = users.find((u) => u.id === user?.id);
  const [enabled, setEnabled] = useState<boolean>(matchedUser?.totpEnabled ?? user?.totpEnabled ?? false);
  const [setupData, setSetupData] = useState<MfaSetupResponse | null>(null);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (matchedUser !== undefined) {
      setEnabled(matchedUser.totpEnabled);
    } else if (user?.totpEnabled !== undefined) {
      setEnabled(user.totpEnabled);
    }
  }, [matchedUser, user?.totpEnabled]);

  const startSetup = useMutation({
    mutationFn: () => api<MfaSetupResponse>("/api/v1/auth/me/mfa/setup", { method: "POST" }),
    onSuccess: (res) => {
      setSetupData(res);
      setCode("");
      setErr(null);
      setMsg(null);
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : "เริ่มตั้งค่า 2FA ไม่สำเร็จ"),
  });

  const confirmEnable = useMutation({
    mutationFn: () =>
      api<{ totpEnabled: boolean }>("/api/v1/auth/me/mfa/enable", {
        method: "POST",
        body: JSON.stringify({ code: code.replace(/\s/g, "") }),
      }),
    onSuccess: () => {
      setEnabled(true);
      setSetupData(null);
      setCode("");
      setErr(null);
      setMsg("เปิดใช้งาน 2FA สำหรับบัญชีของคุณเรียบร้อยแล้ว");
      void qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : "รหัส 6 หลักไม่ถูกต้อง"),
  });

  const disableMfa = useMutation({
    mutationFn: () => api<{ totpEnabled: boolean }>("/api/v1/auth/me/mfa/disable", { method: "POST" }),
    onSuccess: () => {
      setEnabled(false);
      setSetupData(null);
      setErr(null);
      setMsg("ปิดการใช้งาน 2FA เรียบร้อยแล้ว สามารถล็อกอินด้วยรหัสผ่านปกติได้ทันที");
      void qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : "ปิดการใช้งาน 2FA ไม่สำเร็จ"),
  });

  const handleConfirm = (e: FormEvent) => {
    e.preventDefault();
    confirmEnable.mutate();
  };

  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-ink">การยืนยันตัวตน 2 ขั้นตอน (2FA) ของบัญชีคุณ</h2>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                enabled ? "bg-emerald-100 text-emerald-800" : "bg-stone-100 text-ink-muted"
              }`}
            >
              {enabled ? "เปิดใช้งานอยู่" : "ปิดใช้งาน (เข้าด้วยรหัสผ่านปกติ)"}
            </span>
          </div>
          <p className="mt-1 text-xs text-ink-muted">
            ระบบไม่บังคับตั้ง 2FA ตอนล็อกอิน สามารถเลือกเปิดหรือปิดการใช้งาน 2FA ได้ตามความสะดวก
          </p>
        </div>

        <div>
          {enabled ? (
            <button
              type="button"
              disabled={disableMfa.isPending}
              onClick={() => disableMfa.mutate()}
              className="rounded border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
            >
              {disableMfa.isPending ? "กำลังปิด..." : "ปิดการใช้งาน 2FA"}
            </button>
          ) : (
            !setupData && (
              <button
                type="button"
                disabled={startSetup.isPending}
                onClick={() => startSetup.mutate()}
                className="rounded bg-lagoon px-3 py-1.5 text-xs font-medium text-white hover:bg-lagoon-deep disabled:opacity-50"
              >
                {startSetup.isPending ? "กำลังสร้าง QR..." : "เปิดใช้งาน 2FA"}
              </button>
            )
          )}
        </div>
      </div>

      {msg && <p className="mt-2 text-xs font-medium text-lagoon-deep">{msg}</p>}
      {err && <p className="mt-2 text-xs font-medium text-red-600">{err}</p>}

      {setupData && !enabled && (
        <form onSubmit={handleConfirm} className="mt-4 flex flex-wrap items-center gap-4 border-t border-line pt-4">
          <img
            src={setupData.qrDataUrl}
            alt="QR Code สำหรับตั้งค่า 2FA"
            width={130}
            height={130}
            className="rounded border border-line bg-white p-1"
          />
          <div className="space-y-2 text-xs">
            <p className="text-ink-muted">
              1. สแกน QR Code ด้วยแอป Google Authenticator หรือใช้รหัส:{" "}
              <code className="rounded bg-paper px-1.5 py-0.5 font-mono text-ink">{setupData.secret}</code>
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                required
                placeholder="รหัส 6 หลัก"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="h-8 w-32 rounded border border-line px-2.5 text-sm"
              />
              <button
                type="submit"
                disabled={confirmEnable.isPending}
                className="h-8 rounded bg-lagoon px-3 text-xs font-medium text-white hover:bg-lagoon-deep"
              >
                ยืนยันเปิด 2FA
              </button>
              <button
                type="button"
                onClick={() => setSetupData(null)}
                className="h-8 rounded border border-line px-2.5 text-xs text-ink-muted hover:bg-paper"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
