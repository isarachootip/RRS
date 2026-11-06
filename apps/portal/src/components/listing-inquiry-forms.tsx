"use client";

import { useState } from "react";
import type { Locale } from "@/i18n/dictionaries";
import { getApiBaseUrl } from "@/lib/public-api";

export function ListingInquiryForms({
  listingId,
  assetCode,
  locale,
}: {
  listingId: string;
  assetCode: string;
  locale: Locale;
}) {
  const [tab, setTab] = useState<"INQUIRY" | "VIEWING">("INQUIRY");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [lineId, setLineId] = useState("");
  const [message, setMessage] = useState("");
  const [preferredStartAt, setPreferredStartAt] = useState("2026-12-01T10:00");
  const [pdpaConsent, setPdpaConsent] = useState(false);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const isEn = locale === "en";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    const endpoint = tab === "INQUIRY" ? "inquiries" : "viewing-requests";
    const base = { listingId, fullName, phone, email: email || null, lineId: lineId || null, pdpaConsent, websiteUrl };
    const payload =
      tab === "INQUIRY"
        ? { ...base, message }
        : { ...base, preferredStartAt: new Date(preferredStartAt).toISOString(), note: message };

    const res = await fetch(`${getApiBaseUrl()}/public/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      setStatusMsg(data.message ?? (isEn ? "Failed to submit" : "ส่งข้อมูลไม่สำเร็จ"));
      return;
    }
    setStatusMsg(
      isEn ? `Submitted! Reference: ${data.leadCode}` : `ส่งข้อมูลเรียบร้อยแล้ว รหัสอ้างอิง: ${data.leadCode}`,
    );
  };

  const handleTrackClick = async (channel: "LINE" | "PHONE") => {
    try {
      await fetch(`${getApiBaseUrl()}/public/click-events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId, channel, utmSource: "portal", utmCampaign: assetCode }),
      });
    } catch {
      // ignore offline click tracking
    }
  };

  return (
    <section
      className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs sm:p-8"
      data-testid="listing-inquiry-forms"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTab("INQUIRY")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${
              tab === "INQUIRY" ? "bg-lagoon text-white" : "bg-slate-100 text-slate-700"
            }`}
          >
            {isEn ? "Send Inquiry" : "สอบถามข้อมูล"}
          </button>
          <button
            type="button"
            onClick={() => setTab("VIEWING")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${
              tab === "VIEWING" ? "bg-lagoon text-white" : "bg-slate-100 text-slate-700"
            }`}
          >
            {isEn ? "Request Viewing" : "ขอนัดดูห้อง"}
          </button>
        </div>

        <div className="flex gap-2">
          <a
            href={`https://line.me/R/ti/p/@rrs?ref=${encodeURIComponent(assetCode)}`}
            onClick={() => void handleTrackClick("LINE")}
            className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white"
          >
            LINE OA ({assetCode})
          </a>
          <a
            href="tel:+6620000000"
            onClick={() => void handleTrackClick("PHONE")}
            className="rounded-lg border border-lagoon px-3 py-2 text-xs font-semibold text-lagoon"
          >
            {isEn ? "Call Agent" : "โทรติดต่อ"}
          </a>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2">
        <input
          type="text"
          name="websiteUrl"
          value={websiteUrl}
          onChange={(e) => setWebsiteUrl(e.target.value)}
          className="hidden"
          aria-hidden="true"
        />
        <input
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder={isEn ? "Full Name *" : "ชื่อ-นามสกุล *"}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder={isEn ? "Phone Number *" : "เบอร์โทรศัพท์ *"}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={isEn ? "Email (for confirmation)" : "อีเมล (เพื่อรับอีเมลยืนยัน)"}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          value={lineId}
          onChange={(e) => setLineId(e.target.value)}
          placeholder="LINE ID"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        {tab === "VIEWING" && (
          <input
            type="datetime-local"
            required
            value={preferredStartAt}
            onChange={(e) => setPreferredStartAt(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
          />
        )}
        <textarea
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={isEn ? "Additional message or questions" : "ข้อความเพิ่มเติมหรือช่วงเวลาที่สะดวก"}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
        />
        <label className="flex items-center gap-2 text-xs text-slate-700 sm:col-span-2">
          <input type="checkbox" required checked={pdpaConsent} onChange={(e) => setPdpaConsent(e.target.checked)} />
          {isEn
            ? "I consent to the collection and processing of my personal data under PDPA."
            : "ข้าพเจ้ายินยอมให้จัดเก็บและใช้ข้อมูลส่วนบุคคลเพื่อการติดต่อกลับตามนโยบาย PDPA"}
        </label>
        <button
          type="submit"
          className="rounded-lg bg-lagoon px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 sm:col-span-2"
        >
          {tab === "INQUIRY"
            ? isEn
              ? "Submit Inquiry"
              : "ส่งข้อความสอบถาม"
            : isEn
              ? "Book Viewing"
              : "ส่งคำขอนัดดูห้อง"}
        </button>
      </form>
      {statusMsg && <p className="mt-3 text-sm font-semibold text-lagoon">{statusMsg}</p>}
    </section>
  );
}
