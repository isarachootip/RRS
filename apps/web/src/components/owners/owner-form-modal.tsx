"use client";

import { useState } from "react";
import { t } from "@/i18n/th";
import { api } from "@/lib/api";

export interface OwnerRow {
  id: string;
  code: string;
  fullName: string;
  phone: string | null;
  lineId: string | null;
  email: string | null;
  status: "NEW" | "CONTACTED" | "LISTED" | "INACTIVE";
  agentId: string | null;
  agent?: { id: string; fullName: string } | null;
  note?: string | null;
  assetCount?: number;
}

interface DuplicateItem {
  id: string;
  code: string;
  fullName: string;
  agentName: string | null;
}

interface OwnerFormModalProps {
  initial?: OwnerRow | null;
  onClose: () => void;
  onSaved: () => void;
}

export function OwnerFormModal({ initial, onClose, onSaved }: OwnerFormModalProps) {
  const [fullName, setFullName] = useState(initial?.fullName ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [lineId, setLineId] = useState(initial?.lineId ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [status, setStatus] = useState<OwnerRow["status"]>(initial?.status ?? "NEW");
  const [note, setNote] = useState(initial?.note ?? "");
  const [duplicates, setDuplicates] = useState<DuplicateItem[]>([]);
  const [confirmedDup, setConfirmedDup] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSaving(true);
    try {
      if (!confirmedDup && (phone.trim() || lineId.trim() || email.trim())) {
        const qs = new URLSearchParams();
        if (phone.trim()) qs.set("phone", phone.trim());
        if (lineId.trim()) qs.set("lineId", lineId.trim());
        if (email.trim()) qs.set("email", email.trim());
        if (initial?.id) qs.set("excludeId", initial.id);
        const dupRes = await api<{ items: DuplicateItem[] }>(`/api/v1/owners/duplicates?${qs.toString()}`);
        if (dupRes.items.length > 0) {
          setDuplicates(dupRes.items);
          setConfirmedDup(true);
          setSaving(false);
          return;
        }
      }

      const payload = {
        fullName: fullName.trim(),
        phone: phone.trim() || null,
        lineId: lineId.trim() || null,
        email: email.trim() || null,
        status,
        note: note.trim() || null,
      };

      if (initial?.id) {
        await api(`/api/v1/owners/${initial.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      } else {
        await api("/api/v1/owners", { method: "POST", body: JSON.stringify(payload) });
      }
      onSaved();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "บันทึกข้อมูลไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg space-y-4 rounded-lg border border-line bg-surface p-6 shadow-lg"
      >
        <h2 className="text-lg font-semibold text-ink">
          {initial ? `แก้ไขเจ้าของทรัพย์ (${initial.code})` : t("owners.add")}
        </h2>
        {errorMsg && <p className="rounded bg-danger/10 p-2 text-xs text-danger">{errorMsg}</p>}
        {duplicates.length > 0 && (
          <div className="space-y-1 rounded-md border border-amber-500 bg-amber-50 p-3 text-xs text-amber-900">
            <p className="font-semibold">{t("owners.dup.warning")}</p>
            <ul className="list-disc pl-4">
              {duplicates.map((d) => (
                <li key={d.id}>
                  {d.code} — {d.fullName} (ผู้ดูแล: {d.agentName ?? "-"})
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-xs font-medium text-ink sm:col-span-2">
            <span>ชื่อ-นามสกุล *</span>
            <input
              required
              aria-label="ชื่อ-นามสกุลเจ้าของทรัพย์"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1 text-xs font-medium text-ink">
            <span>เบอร์โทรศัพท์</span>
            <input
              aria-label="เบอร์โทรศัพท์เจ้าของทรัพย์"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setConfirmedDup(false);
              }}
              placeholder="081-234-5678"
              className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1 text-xs font-medium text-ink">
            <span>LINE ID</span>
            <input
              aria-label="LINE ID เจ้าของทรัพย์"
              value={lineId}
              onChange={(e) => {
                setLineId(e.target.value);
                setConfirmedDup(false);
              }}
              className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1 text-xs font-medium text-ink">
            <span>อีเมล</span>
            <input
              type="email"
              aria-label="อีเมลเจ้าของทรัพย์"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setConfirmedDup(false);
              }}
              className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1 text-xs font-medium text-ink">
            <span>สถานะ</span>
            <select
              aria-label="สถานะเจ้าของทรัพย์"
              value={status}
              onChange={(e) => setStatus(e.target.value as OwnerRow["status"])}
              className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm"
            >
              <option value="NEW">{t("owners.status.NEW")}</option>
              <option value="CONTACTED">{t("owners.status.CONTACTED")}</option>
              <option value="LISTED">{t("owners.status.LISTED")}</option>
              <option value="INACTIVE">{t("owners.status.INACTIVE")}</option>
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium text-ink sm:col-span-2">
            <span>หมายเหตุ</span>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm"
            />
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-md border border-line px-4 py-2 text-xs text-ink">
            {t("archive.cancel")}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-brand px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
          >
            {confirmedDup ? t("owners.dup.confirmSave") : "บันทึกเจ้าของทรัพย์"}
          </button>
        </div>
      </form>
    </div>
  );
}
