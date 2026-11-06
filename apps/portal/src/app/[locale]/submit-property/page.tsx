"use client";

import { use, useState } from "react";
import { dictionaries, isLocale, type Locale } from "@/i18n/dictionaries";
import { getApiBaseUrl } from "@/lib/public-api";

export default function SubmitPropertyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  const l = (isLocale(locale) ? locale : "th") as Locale;
  const d = dictionaries[l];
  const isEn = l === "en";

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [lineId, setLineId] = useState("");
  const [transactionType, setTransactionType] = useState<"RENT" | "SALE">("RENT");
  const [category, setCategory] = useState("CONDO");
  const [projectName, setProjectName] = useState("");
  const [expectedPrice, setExpectedPrice] = useState("");
  const [note, setNote] = useState("");
  const [pdpaConsent, setPdpaConsent] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    const res = await fetch(`${getApiBaseUrl()}/public/owner-submissions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName,
        phone,
        email: email || null,
        lineId: lineId || null,
        transactionType,
        category,
        projectName: projectName || null,
        expectedPrice: expectedPrice ? Number(expectedPrice) : null,
        note: note || null,
        pdpaConsent,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setStatusMsg(data.message ?? "Error");
      return;
    }
    setStatusMsg(
      isEn
        ? `Property submitted! Reference: ${data.ownerCode}`
        : `ส่งข้อมูลฝากทรัพย์เรียบร้อยแล้ว รหัสอ้างอิง: ${data.ownerCode}`,
    );
  };

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-10" data-testid="submit-property-page">
      <h1 className="text-2xl font-bold text-slate-900">{d.navSubmitProperty}</h1>
      <form
        onSubmit={handleSubmit}
        className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-xs sm:grid-cols-2"
      >
        <input
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder={isEn ? "Owner Full Name *" : "ชื่อ-นามสกุลเจ้าของทรัพย์ *"}
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
          placeholder={isEn ? "Email" : "อีเมล"}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          value={lineId}
          onChange={(e) => setLineId(e.target.value)}
          placeholder="LINE ID"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <select
          value={transactionType}
          onChange={(e) => setTransactionType(e.target.value as "RENT" | "SALE")}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="RENT">{d.txRent}</option>
          <option value="SALE">{d.txSale}</option>
        </select>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="CONDO">{d.catCONDO}</option>
          <option value="HOUSE">{d.catHOUSE}</option>
          <option value="TOWNHOME">{d.catTOWNHOME}</option>
          <option value="LAND">{d.catLAND}</option>
          <option value="FACTORY">{d.catFACTORY}</option>
          <option value="WAREHOUSE">{d.catWAREHOUSE}</option>
        </select>
        <input
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          placeholder={isEn ? "Project / Location" : "ชื่อโครงการ / ทำเล"}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          type="number"
          value={expectedPrice}
          onChange={(e) => setExpectedPrice(e.target.value)}
          placeholder={isEn ? "Expected Price (THB)" : "ราคาที่ต้องการ (บาท)"}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <textarea
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={isEn ? "Property details" : "รายละเอียดทรัพย์สินเพิ่มเติม"}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
        />
        <label className="flex items-center gap-2 text-xs text-slate-700 sm:col-span-2">
          <input type="checkbox" required checked={pdpaConsent} onChange={(e) => setPdpaConsent(e.target.checked)} />
          {isEn
            ? "I consent to PDPA personal data processing so the RRS team can review and list my property."
            : "ข้าพเจ้ายินยอมให้ทีมงาน RRS เก็บข้อมูลติดต่อเพื่อตรวจสอบและลงประกาศตามนโยบาย PDPA"}
        </label>
        <button
          type="submit"
          className="rounded-lg bg-lagoon px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 sm:col-span-2"
        >
          {d.navSubmitProperty}
        </button>
      </form>
      {statusMsg && <p className="text-sm font-semibold text-lagoon">{statusMsg}</p>}
    </main>
  );
}
