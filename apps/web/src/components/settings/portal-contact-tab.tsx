"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface PortalContactConfig {
  lineOaId: string;
  phone: string;
  companyName: string;
}

export function PortalContactTab() {
  const qc = useQueryClient();
  const [lineOaId, setLineOaId] = useState("@rrs");
  const [phone, setPhone] = useState("02-000-0000");
  const [companyName, setCompanyName] = useState("RRS Real Estate");
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["portal-contact-config"],
    queryFn: () => api<PortalContactConfig>("/api/v1/public/listings/contact-config"),
  });

  useEffect(() => {
    if (!data) return;
    setLineOaId(data.lineOaId || "@rrs");
    setPhone(data.phone || "02-000-0000");
    setCompanyName(data.companyName || "RRS Real Estate");
  }, [data]);

  const saveMut = useMutation({
    mutationFn: () =>
      api<PortalContactConfig>("/api/v1/listings/contact-config", {
        method: "PUT",
        body: JSON.stringify({
          lineOaId: lineOaId.trim().startsWith("@") ? lineOaId.trim() : `@${lineOaId.trim()}`,
          phone: phone.trim(),
          companyName: companyName.trim(),
        }),
      }),
    onSuccess: (res) => {
      setLineOaId(res.lineOaId);
      setPhone(res.phone);
      setCompanyName(res.companyName);
      setSavedMsg("บันทึกการตั้งค่า LINE OA และเบอร์ติดต่อหน้าเว็บเรียบร้อยแล้ว");
      void qc.invalidateQueries({ queryKey: ["portal-contact-config"] });
    },
  });

  const cleanOa = lineOaId.trim().startsWith("@") ? lineOaId.trim() : `@${lineOaId.trim() || "rrs"}`;
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
      <div>
        <h2 className="text-base font-semibold text-ink">ตั้งค่า LINE OA องค์กร และเบอร์โทรหน้าเว็บ Portal</h2>
        <p className="mt-1 text-xs text-ink-muted">
          เมื่อลูกค้ากดปุ่มทัก LINE จากการ์ดหรือหน้ารายละเอียดทรัพย์สิน ระบบจะเปิดแชท LINE OA ของบริษัทพร้อมพิมพ์รหัสทรัพย์ (เช่น PR-000013) ให้อัตโนมัติ
        </p>
      </div>

      {savedMsg && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
          ✓ {savedMsg}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-xs font-medium text-ink">
          <span>LINE OA ID องค์กร (ขึ้นต้นด้วย @) *</span>
          <input
            required
            aria-label="LINE OA ID องค์กร"
            value={lineOaId}
            onChange={(e) => setLineOaId(e.target.value)}
            placeholder="เช่น @tamadee หรือ @rrs"
            className={inputCls}
          />
        </label>

        <label className="space-y-1 text-xs font-medium text-ink">
          <span>เบอร์โทรศัพท์ติดต่อหลักหน้าเว็บ *</span>
          <input
            required
            aria-label="เบอร์โทรศัพท์ติดต่อหลัก"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="เช่น 081-234-5678 หรือ 02-000-0000"
            className={inputCls}
          />
        </label>

        <label className="space-y-1 text-xs font-medium text-ink sm:col-span-2">
          <span>ชื่อบริษัท / แบรนด์</span>
          <input
            aria-label="ชื่อบริษัทหรือแบรนด์"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="เช่น Tamadee Real Estate"
            className={inputCls}
          />
        </label>
      </div>

      <div className="space-y-2 rounded-lg border border-line bg-surface-subtle p-4 text-xs">
        <div className="font-semibold text-ink">ตัวอย่างข้อความอัตโนมัติที่ลูกค้าจะส่งเข้า LINE OA ({cleanOa}):</div>
        <p className="rounded border border-line bg-surface p-2.5 text-ink-muted">“{sampleText}”</p>
        <div className="pt-1">
          <a
            href={sampleUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 font-semibold text-white hover:bg-emerald-700"
          >
            💬 ทดสอบกดลิงก์ทัก LINE OA ({cleanOa})
          </a>
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
