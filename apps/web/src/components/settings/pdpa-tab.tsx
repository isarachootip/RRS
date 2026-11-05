"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

export interface PdpaSubjectRow {
  id: string;
  subjectType: "LEAD" | "OWNER";
  code: string;
  fullName: string;
  phone: string | null;
  lineId: string | null;
  email: string | null;
  status: string;
  consentAt: string | null;
  lastActivityAt: string | null;
  updatedAt: string;
  isAnonymized: boolean;
}

export function PdpaTab() {
  const [items, setItems] = useState<PdpaSubjectRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState("");
  const [exportedPreview, setExportedPreview] = useState<string | null>(null);

  const loadSubjects = useCallback(async (qValue = "") => {
    setLoading(true);
    try {
      const qs = qValue.trim() ? `?q=${encodeURIComponent(qValue.trim())}` : "";
      const res = await api<{ items: PdpaSubjectRow[] }>(`/api/v1/pdpa/subjects${qs}`);
      setItems(res.items);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSubjects();
  }, [loadSubjects]);

  const handleExportJson = async (row: PdpaSubjectRow) => {
    const payload = await api<Record<string, unknown>>(
      `/api/v1/pdpa/subjects/${row.subjectType}/${row.id}/export?format=json`,
    );
    setExportedPreview(JSON.stringify(payload, null, 2));
    setStatusMsg(`ส่งออกข้อมูลส่วนบุคคลของ ${row.code} (JSON) สำเร็จ`);
  };

  const handleAnonymize = async (row: PdpaSubjectRow) => {
    await api(`/api/v1/pdpa/subjects/${row.subjectType}/${row.id}/anonymize`, {
      method: "POST",
      body: JSON.stringify({ reason: "คำขอใช้สิทธิ์ลบข้อมูลส่วนบุคคลตาม PDPA จากหน้าตั้งค่าผู้ดูแลระบบ" }),
    });
    setStatusMsg(`ลบข้อมูลระบุตัวตน (Anonymize) ของ ${row.code} สำเร็จ โดยคงยอดสถิติการเงินไว้ครบถ้วน`);
    await loadSubjects(search);
  };

  const handleRunRetentionJob = async () => {
    const res = await api<{ anonymizedCount: number; retentionMonths: number }>("/api/v1/pdpa/jobs/retention-cleanup", {
      method: "POST",
      body: JSON.stringify({ retentionMonths: 24 }),
    });
    setStatusMsg(
      `รันงานล้างข้อมูลตามเกณฑ์ ${res.retentionMonths} เดือนสำเร็จ (Anonymize ${res.anonymizedCount} รายการ)`,
    );
    await loadSubjects(search);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหารหัส, ชื่อ, เบอร์โทร, อีเมล..."
            className="rounded border px-3 py-1.5 text-xs"
          />
          <button
            type="button"
            onClick={() => void loadSubjects(search)}
            className="rounded border bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            ค้นหาเจ้าของข้อมูล
          </button>
        </div>
        <button
          type="button"
          onClick={() => void handleRunRetentionJob()}
          className="rounded bg-teal-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-800"
        >
          รันตรวจสอบ Data Retention (24 เดือน)
        </button>
      </div>

      {statusMsg && (
        <div className="rounded border border-teal-200 bg-teal-50 px-3 py-2 text-xs text-teal-800">{statusMsg}</div>
      )}

      {exportedPreview && (
        <div className="rounded border bg-gray-900 p-3 text-xs text-gray-100">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-semibold">ตัวอย่างข้อมูลส่งออกตามสิทธิ์ PDPA (JSON)</span>
            <button
              type="button"
              onClick={() => setExportedPreview(null)}
              className="text-gray-300 underline hover:text-white"
            >
              ปิดตัวอย่าง
            </button>
          </div>
          <pre className="max-h-48 overflow-auto text-[11px]">{exportedPreview}</pre>
        </div>
      )}

      {loading ? (
        <div className="py-8 text-center text-xs text-gray-500">กำลังโหลดรายชื่อเจ้าของข้อมูลส่วนบุคคล...</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-600">
                <th className="border-b p-3">ประเภท / รหัส</th>
                <th className="border-b p-3">ชื่อ-นามสกุล</th>
                <th className="border-b p-3">ข้อมูลติดต่อ</th>
                <th className="border-b p-3">ความยินยอม PDPA</th>
                <th className="border-b p-3 text-right">การจัดการสิทธิ์ (DSR)</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={`${row.subjectType}-${row.id}`} className="border-b hover:bg-gray-50">
                  <td className="p-3 font-medium text-gray-900">
                    <span className="mr-1.5 rounded bg-gray-100 px-1.5 py-0.5 text-[10px]">{row.subjectType}</span>
                    {row.code}
                  </td>
                  <td className="p-3">{row.fullName}</td>
                  <td className="p-3 text-gray-600">
                    {[row.phone, row.email, row.lineId ? `LINE: ${row.lineId}` : null].filter(Boolean).join(" · ") ||
                      "-"}
                  </td>
                  <td className="p-3 text-gray-600">
                    {row.consentAt ? `ยินยอมเมื่อ ${row.consentAt.slice(0, 10)}` : "ยังไม่ระบุ"}
                  </td>
                  <td className="space-x-2 p-3 text-right">
                    <button
                      type="button"
                      onClick={() => void handleExportJson(row)}
                      className="rounded border px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Export JSON
                    </button>
                    {!row.isAnonymized && (
                      <button
                        type="button"
                        onClick={() => void handleAnonymize(row)}
                        className="rounded bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700"
                      >
                        ลบข้อมูลระบุตัวตน (Anonymize)
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
