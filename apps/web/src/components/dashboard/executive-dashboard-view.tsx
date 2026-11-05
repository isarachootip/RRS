"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { DashboardFilterBar } from "./dashboard-filter-bar";
import {
  ASSET_STATUS_CHART_CONFIG,
  buildReportQueryString,
  type DashboardResponse,
  type FilterOptionsResponse,
  type ReportFilterState,
} from "./dashboard.types";

export function ExecutiveDashboardView() {
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
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const qs = buildReportQueryString(filters);
      const [dashRes, optRes] = await Promise.all([
        api<DashboardResponse>(`/api/v1/reports/dashboard${qs}`),
        api<FilterOptionsResponse>("/api/v1/reports/filter-options"),
      ]);
      setData(dashRes);
      setOptions(optRes);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">ภาพรวมผู้บริหาร (Executive Dashboard)</h1>
        <p className="text-xs text-gray-500">
          สรุปตัวเลขทรัพย์สิน ลูกค้า การแปลงดีล รายได้ห้อง Owner ค่านายหน้า และรายได้สุทธิบริษัท
          (ข้อมูลชุดเดียวกับรายงาน)
        </p>
      </div>

      <DashboardFilterBar filters={filters} setFilters={setFilters} options={options} />

      {loading || !data ? (
        <div className="py-10 text-center text-sm text-gray-500">กำลังโหลดข้อมูล Dashboard...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            {data.topKpis.map((kpi) => (
              <div
                key={kpi.code}
                data-testid={`kpi-${kpi.code}`}
                className="rounded-lg border-l-4 border-teal-700 bg-white p-4 shadow-sm"
              >
                <div className="text-xs font-medium text-gray-500">{kpi.label}</div>
                <div className="mt-1 text-lg font-bold text-gray-900">{kpi.value}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-lg border bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-800">จำนวนสินทรัพย์ตามสถานะ</h2>
                <span className="text-xs text-gray-500">รวมทั้งหมด {data.totalAssets} รายการ</span>
              </div>
              <div className="space-y-2.5 text-xs">
                {ASSET_STATUS_CHART_CONFIG.map((cfg) => {
                  const count = data.assetsByStatus[cfg.status] ?? 0;
                  const pct = data.totalAssets > 0 ? Math.round((count * 100) / data.totalAssets) : 0;
                  return (
                    <div key={cfg.status}>
                      <div className="mb-1 flex justify-between">
                        <span className="font-medium text-gray-700">{cfg.label}</span>
                        <span className="font-semibold">
                          {count} ห้อง ({pct}%)
                        </span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
                        <div
                          data-testid={`status-bar-${cfg.status}`}
                          style={{ width: `${pct}%`, backgroundColor: cfg.colorVar }}
                          className="h-full rounded-full transition-all"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-lg border bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-gray-800">
                Funnel การขาย/เช่า และอัตราปิดดีล ({data.funnel.conversionRatePercent}%)
              </h2>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded border bg-gray-50 p-3">
                  <div className="text-gray-500">1. ลูกค้าใหม่ (New Leads)</div>
                  <div className="mt-1 text-lg font-bold text-gray-900">{data.funnel.newLeads}</div>
                </div>
                <div className="rounded border bg-gray-50 p-3">
                  <div className="text-gray-500">2. นัดดูห้อง (Viewings)</div>
                  <div className="mt-1 text-lg font-bold text-gray-900">{data.funnel.viewings}</div>
                </div>
                <div className="rounded border bg-gray-50 p-3">
                  <div className="text-gray-500">3. จอง / ข้อเสนอ</div>
                  <div className="mt-1 text-lg font-bold text-gray-900">{data.funnel.bookingsAndOffers}</div>
                </div>
                <div className="rounded border bg-teal-50 p-3">
                  <div className="text-teal-800">4. ดีลปิดสำเร็จ (Closed Deals)</div>
                  <div className="mt-1 text-lg font-bold text-teal-900">
                    {data.funnel.closedDeals} ({data.funnel.conversionRatePercent}%)
                  </div>
                </div>
              </div>

              <div className="mt-4 border-t pt-3 text-xs">
                <div className="mb-2 font-semibold text-gray-800">สรุปตัวเลขการเงินและค่านายหน้า (หน่วย: บาท)</div>
                <div className="grid grid-cols-2 gap-2 text-gray-700">
                  <div>
                    รายรับห้อง Owner: <span className="font-semibold">{data.financials.ownerRevenue}</span>
                  </div>
                  <div>
                    รายจ่ายห้อง Owner: <span className="font-semibold">{data.financials.ownerExpense}</span>
                  </div>
                  <div>
                    ส่วนแบ่ง Agent: <span className="font-semibold">{data.financials.agentShare}</span>
                  </div>
                  <div>
                    ส่วนแบ่งค่านายหน้าบริษัท:{" "}
                    <span className="font-semibold">{data.financials.companyCommissionShare}</span>
                  </div>
                  <div>
                    ยอดค้างรับ: <span className="font-semibold text-amber-700">{data.financials.receivables}</span>
                  </div>
                  <div>
                    ยอดค้างจ่าย Agent: <span className="font-semibold text-rose-700">{data.financials.payables}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
