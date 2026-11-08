"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface PortalContactConfig {
  lineOaId: string;
  phone: string;
  companyName: string;
  lineChannelId?: string;
  lineAdminUserId?: string;
}

export function PortalContactTab() {
  const qc = useQueryClient();
  const [lineOaId, setLineOaId] = useState("@229qhxef");
  const [phone, setPhone] = useState("02-000-0000");
  const [companyName, setCompanyName] = useState("RRS Real Estate");
  const [lineAdminUserId, setLineAdminUserId] = useState("U4705c60091e36513849ba962929e0254");
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["portal-contact-config"],
    queryFn: () => api<PortalContactConfig>("/api/v1/public/listings/contact-config"),
  });

  useEffect(() => {
    if (!data) return;
    setLineOaId(data.lineOaId || "@229qhxef");
    setPhone(data.phone || "02-000-0000");
    setCompanyName(data.companyName || "RRS Real Estate");
    if (data.lineAdminUserId) setLineAdminUserId(data.lineAdminUserId);
  }, [data]);

  const saveMut = useMutation({
    mutationFn: () =>
      api<PortalContactConfig>("/api/v1/listings/contact-config", {
        method: "PUT",
        body: JSON.stringify({
          lineOaId: lineOaId.trim().startsWith("@") ? lineOaId.trim() : `@${lineOaId.trim()}`,
          phone: phone.trim(),
          companyName: companyName.trim(),
          lineAdminUserId: lineAdminUserId.trim(),
        }),
      }),
    onSuccess: (res) => {
      setLineOaId(res.lineOaId);
      setPhone(res.phone);
      setCompanyName(res.companyName);
      if (res.lineAdminUserId) setLineAdminUserId(res.lineAdminUserId);
      setSavedMsg("บันทึกการตั้งค่า LINE OA และเบอร์ติดต่อหน้าเว็บเรียบร้อยแล้ว");
      void qc.invalidateQueries({ queryKey: ["portal-contact-config"] });
    },
  });

  const testLineMut = useMutation({
    mutationFn: () =>
      api<{ ok: boolean; status: string; to: string }>("/api/v1/listings/contact-config/test-line", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    onSuccess: (res) => {
      setSavedMsg(`ส่งข้อความทดสอบเข้า LINE (${res.to}) เรียบร้อยแล้ว (${res.status})`);
    },
  });

  const cleanOa = lineOaId.trim().startsWith("@") ? lineOaId.trim() : `@${lineOaId.trim() || "229qhxef"}`;
  const sampleText = `สวัสดีครับ/ค่ะ สนใจเช่าทรัพย์สินรหัส PR-000013 — คอนโด เดอะ ริเวอร์ไซด์ ราคา ฿21,000 ขอสอบถามข้อมูลเพิ่มเติม/นัดชมทรัพย์ครับ`;
  const sampleUrl = `https://line.me/R/oaMessage/${encodeURIComponent(cleanOa)}/?${encodeURIComponent(sampleText)}`;
  const inputCls = "w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setSavedMsg(null);
        saveMut.mutate();
      }}
      className="max-w-2xl space-y-5 rounded-xl border border-line bg-surface p-6 shadow-xs"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-ink">ตั้งค่า LINE OA องค์กร และแจ้งเตือน LINE Messaging API</h2>
          <p className="mt-1 text-xs text-ink-muted">
            เชื่อมกับ LINE Channel ID: <span className="font-mono font-semibold text-ink">2012471586</span> ({cleanOa}) เรียบร้อยแล้ว
          </p>
        </div>
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
          ● เชื่อมต่อ LINE Messaging API แล้ว
        </span>
      </div>

      {savedMsg && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
          ✓ {savedMsg}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-xs font-medium text-ink">
          <span>LINE OA ID องค์กร (ขึ้นต้นด้วย @) *</span>
          <input required aria-label="LINE OA ID องค์กร" value={lineOaId} onChange={(e) => setLineOaId(e.target.value)} placeholder="@229qhxef" className={inputCls} />
        </label>

        <label className="space-y-1 text-xs font-medium text-ink">
          <span>เบอร์โทรศัพท์ติดต่อหลักหน้าเว็บ *</span>
          <input required aria-label="เบอร์โทรศัพท์ติดต่อหลัก" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="เช่น 081-234-5678" className={inputCls} />
        </label>

        <label className="space-y-1 text-xs font-medium text-ink">
          <span>ชื่อบริษัท / แบรนด์</span>
          <input aria-label="ชื่อบริษัทหรือแบรนด์" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={inputCls} />
        </label>

        <label className="space-y-1 text-xs font-medium text-ink">
          <span>LINE User ID แอดมินผู้รับแจ้งเตือน</span>
          <input aria-label="LINE User ID แอดมิน" value={lineAdminUserId} onChange={(e) => setLineAdminUserId(e.target.value)} className={`${inputCls} font-mono text-xs`} />
        </label>
      </div>

      <div className="space-y-2 rounded-lg border border-line bg-surface-subtle p-4 text-xs">
        <div className="font-semibold text-ink">Webhook URL (สำหรับใส่ใน LINE Developers Console):</div>
        <code className="block rounded border border-line bg-surface px-2.5 py-1.5 font-mono text-ink">
          https://rrs.tamadee.online/api/v1/public/listings/line-webhook
        </code>
        <div className="pt-2 font-semibold text-ink">ตัวอย่างข้อความอัตโนมัติที่ลูกค้าจะส่งเข้า LINE OA ({cleanOa}):</div>
        <p className="rounded border border-line bg-surface p-2.5 text-ink-muted">“{sampleText}”</p>
        <div className="flex flex-wrap gap-2 pt-1">
          <a
            href={sampleUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 font-semibold text-white hover:bg-emerald-700"
          >
            💬 ทดสอบกดลิงก์ทัก LINE OA ({cleanOa})
          </a>
          <button
            type="button"
            disabled={testLineMut.isPending}
            onClick={() => testLineMut.mutate()}
            className="inline-flex items-center gap-1.5 rounded-md border border-emerald-600 bg-white px-3 py-1.5 font-semibold text-emerald-700 hover:bg-emerald-50"
          >
            🔔 ทดสอบยิงแจ้งเตือนเข้า LINE แอดมิน
          </button>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saveMut.isPending}
          className="rounded-md bg-brand px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {saveMut.isPending ? "กำลังบันทึก..." : "บันทึกการตั้งค่า LINE OA"}
        </button>
      </div>
    </form>
  );
}
