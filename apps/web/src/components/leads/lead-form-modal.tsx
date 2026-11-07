"use client";

import { useEffect, useState } from "react";
import { type LeadFormState, LeadPreferencesFields } from "@/components/leads/lead-preferences-fields";
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
  nationality?: string | null;
  source?: string | null;
  preferredProjectId?: string | null;
  preferredCategory?: string | null;
  preferredRoomType?: string | null;
  minAreaSqm?: string | number | null;
  occupants?: number | null;
  moveInDate?: string | null;
  leaseMonths?: number | null;
  petRequired?: boolean;
  specialNote?: string | null;
}

const LEAD_SOURCES = [
  { value: "FACEBOOK", label: "Facebook" }, { value: "LINE", label: "LINE" },
  { value: "PHONE", label: "โทรศัพท์ (Phone)" }, { value: "WEBSITE", label: "เว็บไซต์ (Website)" },
  { value: "WALK_IN", label: "Walk-in" }, { value: "REFERRAL", label: "บอกต่อ (Referral)" },
  { value: "PROPERTY_PORTAL", label: "เว็บประกาศ (Portal)" }, { value: "OTHER", label: "อื่นๆ" },
] as const;

function initLeadForm(initial?: EditableLead | null): LeadFormState {
  return {
    intent: (initial?.intent ?? "RENT") as "RENT" | "BUY",
    fullName: initial?.fullName ?? "",
    phone: initial?.phone && !initial.phone.includes("x") ? initial.phone : "",
    lineId: initial?.lineId ?? "", email: initial?.email ?? "", nationality: initial?.nationality ?? "",
    source: initial?.source ?? "FACEBOOK", ownerAgentId: initial?.ownerAgentId ?? "",
    budgetMin: initial?.budgetMin != null ? String(initial.budgetMin) : "",
    budgetMax: initial?.budgetMax != null ? String(initial.budgetMax) : "",
    preferredLocation: initial?.preferredLocation ?? "", preferredProjectId: initial?.preferredProjectId ?? "",
    preferredCategory: initial?.preferredCategory ?? "CONDO", preferredRoomType: initial?.preferredRoomType ?? "",
    minAreaSqm: initial?.minAreaSqm != null ? String(initial.minAreaSqm) : "",
    occupants: initial?.occupants != null ? String(initial.occupants) : "",
    moveInDate: initial?.moveInDate ? String(initial.moveInDate).slice(0, 10) : "",
    leaseMonths: initial?.leaseMonths != null ? String(initial.leaseMonths) : "",
    petRequired: Boolean(initial?.petRequired), specialNote: initial?.specialNote ?? "",
  };
}

export function LeadFormModal(props: {
  open: boolean;
  initial?: EditableLead | null;
  onClose: () => void;
  onSaved: () => void;
  onSavedAndOpen?: (leadId: string) => void;
}) {
  const { open, initial, onClose, onSaved, onSavedAndOpen } = props;
  const [form, setForm] = useState<LeadFormState>(() => initLeadForm(initial));
  const [agents, setAgents] = useState<Array<{ id: string; fullName: string }>>([]);
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [duplicates, setDuplicates] = useState<DuplicateLeadMatch[]>([]);
  const [confirmedDuplicate, setConfirmedDuplicate] = useState(false);
  const [requestedIds, setRequestedIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(initLeadForm(initial));
    setDuplicates([]);
    setConfirmedDuplicate(false);
    setError(null);
    void api<{ items?: Array<{ id: string; fullName: string }> }>("/api/v1/agents").then((r) => setAgents(r?.items ?? [])).catch(() => {});
    void api<{ items?: Array<{ id: string; name: string }> }>("/api/v1/projects").then((r) => setProjects(r?.items ?? [])).catch(() => {});
    if (initial?.id) {
      void api<EditableLead>(`/api/v1/leads/${initial.id}`).then((full) => { if (full?.id) setForm(initLeadForm(full)); }).catch(() => {});
    }
  }, [open, initial]);

  if (!open) return null;

  const patchForm = (patch: Partial<LeadFormState>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    setConfirmedDuplicate(false);
  };

  async function requestCollab(leadId: string) {
    try {
      await api(`/api/v1/leads/${leadId}/collaborators`, { method: "POST", body: JSON.stringify({ note: "พบลูกค้าซ้ำจากหน้าเพิ่มลูกค้า ขอร่วมดูแล" }) });
      setRequestedIds((prev) => [...prev, leadId]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ส่งคำขอร่วมงานไม่สำเร็จ");
    }
  }

  async function saveLead(openDetailAfter: boolean) {
    setError(null);
    setSubmitting(true);
    try {
      if (!confirmedDuplicate && !initial?.id && (form.phone || form.lineId || form.email)) {
        const params = new URLSearchParams();
        if (form.phone) params.set("phone", form.phone);
        if (form.lineId) params.set("line", form.lineId);
        if (form.email) params.set("email", form.email);
        const dupRes = await api<{ duplicates?: DuplicateLeadMatch[]; items?: DuplicateLeadMatch[] }>(`/api/v1/leads/duplicates?${params.toString()}`);
        const found = dupRes.duplicates ?? dupRes.items ?? [];
        if (found.length > 0) { setDuplicates(found); setConfirmedDuplicate(true); return; }
      }
      const payload = {
        intent: form.intent, fullName: form.fullName.trim(),
        phone: form.phone.trim() ? form.phone.trim() : initial?.id ? undefined : null,
        lineId: form.lineId.trim() || null, email: form.email.trim() || null, nationality: form.nationality.trim() || null,
        source: form.source.toUpperCase(), ownerAgentId: form.ownerAgentId || undefined,
        budgetMin: form.budgetMin ? Number(form.budgetMin) : null, budgetMax: form.budgetMax ? Number(form.budgetMax) : null,
        preferredLocation: form.preferredLocation.trim() || null, preferredProjectId: form.preferredProjectId || null,
        preferredCategory: form.preferredCategory || null, preferredRoomType: form.preferredRoomType || null,
        minAreaSqm: form.minAreaSqm ? Number(form.minAreaSqm) : null, occupants: form.occupants ? Number(form.occupants) : null,
        moveInDate: form.moveInDate || null, leaseMonths: form.leaseMonths ? Number(form.leaseMonths) : null,
        petRequired: form.petRequired, specialNote: form.specialNote.trim() || null,
      };
      const saved = initial?.id
        ? await api<{ id?: string }>(`/api/v1/leads/${initial.id}`, { method: "PATCH", body: JSON.stringify(payload) })
        : await api<{ id?: string }>("/api/v1/leads", { method: "POST", body: JSON.stringify(payload) });
      onSaved();
      onClose();
      if (openDetailAfter && saved?.id && onSavedAndOpen) onSavedAndOpen(saved.id);
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
      <form onSubmit={(e) => { e.preventDefault(); void saveLead(false); }} className="max-h-[90vh] w-full max-w-3xl space-y-4 overflow-y-auto rounded-lg border border-line bg-surface p-6 shadow-xl">
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
                {requestedIds.includes(d.id) ? <span className="text-brand">{t("leads.dup.requested")}</span> : (
                  <button type="button" onClick={() => requestCollab(d.id)} className="rounded bg-brand px-2.5 py-1 text-xs font-medium text-white">{t("leads.dup.requestCollab")}</button>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="space-y-3 rounded-lg border border-line bg-surface p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">ส่วนที่ 1: ข้อมูลติดต่อพื้นฐานและผู้ดูแล</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-ink">ความต้องการ<select aria-label="ความต้องการ" value={form.intent} onChange={(e) => patchForm({ intent: e.target.value as "RENT" | "BUY" })} className={inputCls}><option value="RENT">{t("leads.intent.RENT")}</option><option value="BUY">{t("leads.intent.BUY")}</option></select></label>
            <label className="text-xs font-medium text-ink">ช่องทางติดต่อ<select aria-label="ช่องทางติดต่อ" value={form.source} onChange={(e) => patchForm({ source: e.target.value })} className={inputCls}>{LEAD_SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label>
            <label className="text-xs font-medium text-ink">ชื่อ-นามสกุล *<input type="text" required aria-label="ชื่อ-นามสกุล" value={form.fullName} onChange={(e) => patchForm({ fullName: e.target.value })} className={inputCls} /></label>
            <label className="text-xs font-medium text-ink">เบอร์โทรศัพท์<input type="text" aria-label="เบอร์โทรศัพท์" placeholder="081-234-5678" value={form.phone} onChange={(e) => patchForm({ phone: e.target.value })} className={inputCls} /></label>
            <label className="text-xs font-medium text-ink">LINE ID<input type="text" aria-label="LINE ID" value={form.lineId} onChange={(e) => patchForm({ lineId: e.target.value })} className={inputCls} /></label>
            <label className="text-xs font-medium text-ink">อีเมล<input type="email" aria-label="อีเมล" value={form.email} onChange={(e) => patchForm({ email: e.target.value })} className={inputCls} /></label>
            <label className="text-xs font-medium text-ink">สัญชาติ<input type="text" aria-label="สัญชาติ" placeholder="เช่น ไทย, อังกฤษ, ญี่ปุ่น" value={form.nationality} onChange={(e) => patchForm({ nationality: e.target.value })} className={inputCls} /></label>
            <label className="text-xs font-medium text-ink">ผู้ดูแลลูกค้า (Owner Agent)<select aria-label="ผู้ดูแลลูกค้า" value={form.ownerAgentId} onChange={(e) => patchForm({ ownerAgentId: e.target.value })} className={inputCls}><option value="">-- ผู้ที่กำลังล็อกอิน (ตัวเอง) --</option>{agents.map((ag) => <option key={ag.id} value={ag.id}>{ag.fullName}</option>)}</select></label>
          </div>
        </div>
        <LeadPreferencesFields form={form} projects={projects} onChange={patchForm} />
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded border border-line px-4 py-2 text-sm text-ink">ยกเลิก</button>
          {!initial?.id && onSavedAndOpen && (
            <button type="button" disabled={submitting || !form.fullName.trim()} onClick={() => void saveLead(true)} className="rounded border border-brand bg-lagoon-soft px-4 py-2 text-sm font-medium text-brand hover:opacity-90">บันทึกและเปิดหน้าจับคู่ห้อง</button>
          )}
          <button type="submit" disabled={submitting} className="rounded bg-brand px-4 py-2 text-sm font-medium text-white">{confirmedDuplicate ? "ยืนยันบันทึกซ้ำ" : "บันทึก"}</button>
        </div>
      </form>
    </div>
  );
}
