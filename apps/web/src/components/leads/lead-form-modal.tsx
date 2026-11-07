"use client";

import { useEffect, useState } from "react";
import type { LeadItem } from "@/components/leads/leads-kanban";
import { t } from "@/i18n/th";
import { api } from "@/lib/api";

export interface DuplicateLeadMatch {
  id: string;
  code: string;
  abbreviatedName?: string;
  fullName?: string;
  ownerAgentId: string;
  ownerAgentName: string;
  status: string;
}

export interface EditableLead extends Partial<LeadItem> {
  id?: string;
  lineId?: string | null;
  email?: string | null;
  source?: string | null;
}

const LEAD_SOURCES = [
  { value: "FACEBOOK", label: "Facebook" },
  { value: "LINE", label: "LINE" },
  { value: "PHONE", label: "โทรศัพท์ (Phone)" },
  { value: "WEBSITE", label: "เว็บไซต์ (Website)" },
  { value: "WALK_IN", label: "Walk-in" },
  { value: "REFERRAL", label: "บอกต่อ (Referral)" },
  { value: "PROPERTY_PORTAL", label: "เว็บประกาศ (Portal)" },
  { value: "OTHER", label: "อื่นๆ" },
] as const;

const TEXT_FIELDS = [
  { key: "fullName", label: "ชื่อ-นามสกุล", required: true, type: "text" },
  { key: "phone", label: "เบอร์โทรศัพท์", required: false, type: "text" },
  { key: "lineId", label: "LINE ID", required: false, type: "text" },
  { key: "email", label: "อีเมล", required: false, type: "email" },
  { key: "budgetMin", label: "งบประมาณต่ำสุด", required: false, type: "number" },
  { key: "budgetMax", label: "งบประมาณสูงสุด", required: false, type: "number" },
  { key: "preferredLocation", label: "ทำเลที่ต้องการ", required: false, type: "text" },
] as const;

function initLeadForm(initial?: EditableLead | null) {
  return {
    intent: (initial?.intent ?? "RENT") as "RENT" | "BUY",
    fullName: initial?.fullName ?? "",
    phone: initial?.phone && !initial.phone.includes("x") ? initial.phone : "",
    lineId: initial?.lineId ?? "",
    email: initial?.email ?? "",
    source: initial?.source ?? "FACEBOOK",
    budgetMin: initial?.budgetMin != null ? String(initial.budgetMin) : "",
    budgetMax: initial?.budgetMax != null ? String(initial.budgetMax) : "",
    preferredLocation: initial?.preferredLocation ?? "",
    preferredCategory: "CONDO",
    petRequired: false,
  };
}

export function LeadFormModal(props: {
  open: boolean;
  initial?: EditableLead | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { open, initial, onClose, onSaved } = props;
  const [form, setForm] = useState(() => initLeadForm(initial));
  const [duplicates, setDuplicates] = useState<DuplicateLeadMatch[]>([]);
  const [confirmedDuplicate, setConfirmedDuplicate] = useState(false);
  const [requestedIds, setRequestedIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(initLeadForm(initial));
      setDuplicates([]);
      setConfirmedDuplicate(false);
      setError(null);
    }
  }, [open, initial]);

  if (!open) return null;

  async function requestCollab(leadId: string) {
    try {
      await api(`/api/v1/leads/${leadId}/collaborators`, {
        method: "POST",
        body: JSON.stringify({ note: "พบลูกค้าซ้ำจากหน้าเพิ่มลูกค้า ขอร่วมดูแล" }),
      });
      setRequestedIds((prev) => [...prev, leadId]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ส่งคำขอร่วมงานไม่สำเร็จ");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (!confirmedDuplicate && !initial?.id && (form.phone || form.lineId || form.email)) {
        const params = new URLSearchParams();
        if (form.phone) params.set("phone", form.phone);
        if (form.lineId) params.set("line", form.lineId);
        if (form.email) params.set("email", form.email);
        const dupRes = await api<{ duplicates?: DuplicateLeadMatch[]; items?: DuplicateLeadMatch[] }>(
          `/api/v1/leads/duplicates?${params.toString()}`,
        );
        const found = dupRes.duplicates ?? dupRes.items ?? [];
        if (found.length > 0) {
          setDuplicates(found);
          setConfirmedDuplicate(true);
          return;
        }
      }
      const payload = {
        ...form,
        source: form.source.toUpperCase(),
        phone: form.phone ? form.phone : undefined,
        lineId: form.lineId || null,
        email: form.email || null,
        budgetMin: form.budgetMin ? Number(form.budgetMin) : null,
        budgetMax: form.budgetMax ? Number(form.budgetMax) : null,
      };
      if (initial?.id) {
        await api(`/api/v1/leads/${initial.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      } else {
        await api("/api/v1/leads", { method: "POST", body: JSON.stringify({ ...payload, phone: form.phone || null }) });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการบันทึก");
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls = "mt-1 w-full rounded border border-line bg-surface px-3 py-2 text-sm text-ink";
  const dialogTitle = initial?.id ? `แก้ไขข้อมูลลูกค้า (${initial.code ?? ""})` : t("leads.add");

  return (
    <div role="dialog" aria-modal="true" aria-label={dialogTitle} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form onSubmit={handleSubmit} className="max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-lg border border-line bg-surface p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">{dialogTitle}</h2>
          <button type="button" onClick={onClose} className="text-sm text-ink-muted">ปิด</button>
        </div>
        {error && <p className="rounded bg-danger/10 p-3 text-sm text-danger">{error}</p>}
        {duplicates.length > 0 && (
          <div className="space-y-2 rounded-md border border-warning bg-warning/10 p-3 text-sm text-ink">
            <p className="font-medium">{t("leads.dup.title")}</p>
            {duplicates.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-2 text-xs">
                <span>{d.code} · {d.abbreviatedName ?? d.fullName} · ผู้ดูแล: <strong>{d.ownerAgentName}</strong></span>
                {requestedIds.includes(d.id) ? (
                  <span className="text-brand">{t("leads.dup.requested")}</span>
                ) : (
                  <button type="button" onClick={() => requestCollab(d.id)} className="rounded bg-brand px-2.5 py-1 text-xs font-medium text-white">
                    {t("leads.dup.requestCollab")}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium text-ink">
            ความต้องการ
            <select aria-label="ความต้องการ" value={form.intent} onChange={(e) => setForm({ ...form, intent: e.target.value as "RENT" | "BUY" })} className={inputCls}>
              <option value="RENT">{t("leads.intent.RENT")}</option>
              <option value="BUY">{t("leads.intent.BUY")}</option>
            </select>
          </label>
          <label className="text-xs font-medium text-ink">
            ช่องทางติดต่อ
            <select aria-label="ช่องทางติดต่อ" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} className={inputCls}>
              {LEAD_SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>
          {TEXT_FIELDS.map((f) => (
            <label key={f.key} className="text-xs font-medium text-ink">
              {f.label} {f.required ? "*" : ""}
              <input type={f.type} required={f.required} aria-label={f.label} value={form[f.key]} onChange={(e) => { setForm({ ...form, [f.key]: e.target.value }); setConfirmedDuplicate(false); }} className={inputCls} />
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded border border-line px-4 py-2 text-sm text-ink">ยกเลิก</button>
          <button type="submit" disabled={submitting} className="rounded bg-brand px-4 py-2 text-sm font-medium text-white">
            {confirmedDuplicate ? "ยืนยันบันทึกซ้ำ" : "บันทึก"}
          </button>
        </div>
      </form>
    </div>
  );
}
