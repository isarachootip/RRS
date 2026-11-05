"use client";

import { useCallback, useContext, useEffect, useState } from "react";
import { OwnerFinanceView } from "@/components/finance/owner-finance-view";
import { api } from "@/lib/api";
import { AuthContext } from "@/lib/auth";
import { DashboardFilterBar } from "./dashboard-filter-bar";
import {
  buildReportQueryString,
  type FilterOptionsResponse,
  type ReportFilterState,
  type ReportSummaryResponse,
} from "./dashboard.types";

export function ReportsHubView({ canExportOverride }: { canExportOverride?: boolean }) {
  const auth = useContext(AuthContext);
  const canExport =
    canExportOverride !== undefined
      ? canExportOverride
      : auth?.user
        ? Boolean(auth.user.permissions?.["report.export"])
        : true;

  const [mainTab, setMainTab] = useState<"SUMMARY" | "OWNER_FINANCE">("SUMMARY");
  const [filters, setFilters] = useState<ReportFilterState>({
    startDate: "",
    endDate: "",
    teamId: "",
    projectId: "",
    category: "",
    dealType: "ALL",
    granularity: "MONTH",
    groupBy: "PERIOD",
  });
  const [options, setOptions] = useState<FilterOptionsResponse>({ teams: [], projects: [] });
  const [summary, setSummary] = useState<ReportSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [exportStatus, setExportStatus] = useState("");

  const loadSummary = useCallback(async () => {
    setLoading(true);
    try {
      const qs = buildReportQueryString(filters);
      const [sumRes, optRes] = await Promise.all([
        api<ReportSummaryResponse>(`/api/v1/reports/summary${qs}`),
        api<FilterOptionsResponse>("/api/v1/reports/filter-options"),
      ]);
      setSummary(sumRes);
      setOptions(optRes);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    if (mainTab === "SUMMARY") void loadSummary();
  }, [mainTab, loadSummary]);

  const handleExport = async (format: "csv" | "xlsx") => {
    if (!canExport) return;
    setExportStatus(`กำลังสร้างไฟล์ ${format.toUpperCase()}...`);
    try {
      const qs = buildReportQueryString(filters);
      const sep = qs ? "&" : "?";
      await api<string>(`/api/v1/reports/export${qs}${sep}format=${format}`);
      setExportStatus(`ส่งออกรายงาน ${format.toUpperCase()} สำเร็จ`);
    } catch (e) {
      setExportStatus(e instanceof Error ? e.message : "ส่งออกรายงานไม่สำเร็จ");
    }
  };

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMainTab("SUMMARY")}
            className={`rounded px-3 py-1.5 text-xs font-medium ${mainTab === "SUMMARY" ? "bg-teal-700 text-white" : "bg-gray-100 text-gray-700"}`}
          >
            รายงานสรุปและธุรกรรม (Summary & Export)
          </button>
          <button
            type="button"
            onClick={() => setMainTab("OWNER_FINANCE")}
            className={`rounded px-3 py-1.5 text-xs font-medium ${mainTab === "OWNER_FINANCE" ? "bg-teal-700 text-white" : "bg-gray-100 text-gray-700"}`}
          >
            การเงินและรายได้ห้อง Owner (Owner Finance)
          </button>
        </div>

        {mainTab === "SUMMARY" && canExport && (
          <div className="flex items-center gap-2">
            {exportStatus && <span className="text-xs text-teal-800">{exportStatus}</span>}
            <button
              type="button"
              onClick={() => void handleExport("csv")}
              className="rounded border border-teal-700 px-3 py-1.5 text-xs font-medium text-teal-800 hover:bg-teal-50"
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => void handleExport("xlsx")}
              className="rounded bg-teal-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-800"
            >
              Export Excel
            </button>
          </div>
        )}
      </div>

      {mainTab === "OWNER_FINANCE" ? (
        <OwnerFinanceView />
      ) : (
        <>
          <DashboardFilterBar filters={filters} setFilters={setFilters} options={options} showGroupControls />

          {loading || !summary ? (
            <div className="py-10 text-center text-sm text-gray-500">กำลังโหลดรายงานสรุป...</div>
          ) : (
            <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50 text-left text-gray-600">
                    <th className="border-b p-3">หมวดหมู่ / ช่วงเวลา</th>
                    <th className="border-b p-3 text-right">ดีล</th>
                    <th className="border-b p-3 text-right">รายได้สุทธิ Owner</th>
                    <th className="border-b p-3 text-right">ค่านายหน้ารวม</th>
                    <th className="border-b p-3 text-right">ส่วนแบ่ง Agent</th>
                    <th className="border-b p-3 text-right">รายได้สุทธิบริษัท</th>
                    <th className="border-b p-3 text-right">ค้างรับ</th>
                    <th className="border-b p-3 text-right">ค้างจ่าย</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.buckets.map((b) => (
                    <tr key={b.key} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-medium text-gray-900">{b.label}</td>
                      <td className="p-3 text-right">{b.dealsCount}</td>
                      <td className="p-3 text-right">{b.ownerNetIncome}</td>
                      <td className="p-3 text-right">{b.totalCommission}</td>
                      <td className="p-3 text-right">{b.agentShare}</td>
                      <td className="p-3 text-right font-semibold text-teal-900">{b.companyNetIncome}</td>
                      <td className="p-3 text-right text-amber-700">{b.receivables}</td>
                      <td className="p-3 text-right text-rose-700">{b.payables}</td>
                    </tr>
                  ))}
                  <tr className="bg-teal-50/60 font-bold text-gray-900">
                    <td className="p-3">รวมทั้งหมด</td>
                    <td className="p-3 text-right">{summary.totals.dealsCount}</td>
                    <td className="p-3 text-right">{summary.totals.ownerNetIncome}</td>
                    <td className="p-3 text-right">{summary.totals.totalCommission}</td>
                    <td className="p-3 text-right">{summary.totals.agentShare}</td>
                    <td className="p-3 text-right text-teal-900">{summary.totals.companyNetIncome}</td>
                    <td className="p-3 text-right text-amber-800">{summary.totals.receivables}</td>
                    <td className="p-3 text-right text-rose-800">{summary.totals.payables}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
