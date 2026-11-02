"use client";

import { formatDecimalBaht, toSatang } from "@rrs/shared";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { OwnerNetIncomeReportResponse } from "./finance.types";

export function OwnerNetIncomeTab() {
  const [year, setYear] = useState(2027);
  const [report, setReport] = useState<OwnerNetIncomeReportResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<OwnerNetIncomeReportResponse>(`/api/v1/finance/reports/owner-net-income?year=${year}`);
      setReport(data);
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">รายงานรายได้สุทธิห้อง Owner (Cash Basis)</h3>
          <p className="text-xs text-slate-500">
            สูตร: ค่าเช่าที่รับจริง + รายรับอื่น − ค่านายหน้าที่จ่ายจริง − ค่าใช้จ่าย (หน่วย: บาท.สตางค์)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="report-year" className="text-xs font-medium text-slate-700">
            ปี พ.ศ./ค.ศ.:
          </label>
          <select
            id="report-year"
            aria-label="ปีรายงาน"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-lg border px-3 py-1.5 text-sm"
          >
            {[2026, 2027, 2028].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border bg-white p-8 text-center text-sm text-slate-500">กำลังคำนวณรายงาน...</div>
      ) : !report || report.rooms.length === 0 ? (
        <div className="rounded-xl border bg-white p-8 text-center text-sm text-slate-500">
          ไม่พบข้อมูลห้องประเภท Owner ในปีที่เลือก
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="rounded-xl border bg-white p-3.5 shadow-sm">
              <div className="text-xs text-slate-500">ค่าเช่าที่รับจริงรวม</div>
              <div className="mt-1 text-base font-bold text-slate-900">
                {formatDecimalBaht(report.grandTotals.rentCollected)} ฿
              </div>
            </div>
            <div className="rounded-xl border bg-white p-3.5 shadow-sm">
              <div className="text-xs text-slate-500">รายรับอื่นรวม</div>
              <div className="mt-1 text-base font-bold text-slate-900">
                {formatDecimalBaht(report.grandTotals.otherIncome)} ฿
              </div>
            </div>
            <div className="rounded-xl border bg-white p-3.5 shadow-sm">
              <div className="text-xs text-slate-500">ค่านายหน้าที่จ่ายจริง</div>
              <div className="mt-1 text-base font-bold text-amber-700">
                {formatDecimalBaht(report.grandTotals.commissionPaid)} ฿
              </div>
            </div>
            <div className="rounded-xl border bg-white p-3.5 shadow-sm">
              <div className="text-xs text-slate-500">ค่าใช้จ่ายรวม</div>
              <div className="mt-1 text-base font-bold text-rose-700">
                {formatDecimalBaht(report.grandTotals.expenses)} ฿
              </div>
            </div>
            <div className="rounded-xl border bg-emerald-50 p-3.5 shadow-sm">
              <div className="text-xs font-medium text-emerald-800">รายได้สุทธิรวมทั้งปี</div>
              <div className="mt-1 text-base font-bold text-emerald-900" data-testid="grand-net-income">
                {formatDecimalBaht(report.grandTotals.netIncome)} ฿
              </div>
            </div>
          </div>

          {report.rooms.map((room) => (
            <div key={room.assetId} className="overflow-hidden rounded-xl border bg-white shadow-sm">
              <div className="flex items-center justify-between border-b bg-slate-50 px-4 py-2.5">
                <div className="font-semibold text-slate-900">
                  {room.assetCode} {room.unitNo ? `· ห้อง ${room.unitNo}` : ""}
                </div>
                <div className="text-xs font-semibold text-emerald-800">
                  สุทธิทั้งปี: {formatDecimalBaht(room.totals.netIncome)} ฿
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b bg-slate-50/60 text-slate-600">
                    <tr>
                      <th className="px-3 py-2">เดือน</th>
                      <th className="px-3 py-2 text-right">ค่าเช่าตามสัญญา</th>
                      <th className="px-3 py-2 text-right">รับจริง</th>
                      <th className="px-3 py-2 text-right">รายรับอื่น</th>
                      <th className="px-3 py-2 text-right">ค่านายหน้า</th>
                      <th className="px-3 py-2 text-right">ค่าใช้จ่าย</th>
                      <th className="px-3 py-2 text-right font-semibold">รายได้สุทธิ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {room.monthly.map((m) => {
                      const isNeg = toSatang(m.netIncome) < 0n;
                      return (
                        <tr key={m.month} className="hover:bg-slate-50">
                          <td className="px-3 py-2 font-medium text-slate-900">{m.month}</td>
                          <td className="px-3 py-2 text-right text-slate-500">{formatDecimalBaht(m.contractRent)}</td>
                          <td className="px-3 py-2 text-right text-slate-800">{formatDecimalBaht(m.rentCollected)}</td>
                          <td className="px-3 py-2 text-right text-slate-800">{formatDecimalBaht(m.otherIncome)}</td>
                          <td className="px-3 py-2 text-right text-amber-700">{formatDecimalBaht(m.commissionPaid)}</td>
                          <td className="px-3 py-2 text-right text-rose-700">{formatDecimalBaht(m.expenses)}</td>
                          <td
                            className={`px-3 py-2 text-right font-semibold ${
                              isNeg ? "text-rose-700" : "text-emerald-700"
                            }`}
                          >
                            {formatDecimalBaht(m.netIncome)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
