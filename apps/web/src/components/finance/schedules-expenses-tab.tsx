"use client";

import { formatDecimalBaht } from "@rrs/shared";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { RecordExpenseModal } from "./expense-modal";
import { RecordPaymentModal } from "./finance-modals";
import {
  EXPENSE_CATEGORY_LABELS,
  SCHEDULE_STATUS_COLORS,
  SCHEDULE_STATUS_LABELS,
  type ExpenseRecord,
  type RentScheduleRecord,
} from "./finance.types";

export function SchedulesAndExpensesTab() {
  const [schedules, setSchedules] = useState<RentScheduleRecord[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [assets, setAssets] = useState<Array<{ id: string; code: string; unitNo: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [paySchedule, setPaySchedule] = useState<RentScheduleRecord | null>(null);
  const [showStandalonePay, setShowStandalonePay] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [schedData, expData, assetRes] = await Promise.all([
        api<RentScheduleRecord[]>("/api/v1/finance/rent-schedules"),
        api<ExpenseRecord[]>("/api/v1/finance/expenses"),
        api<{ items?: Array<{ id: string; code: string; unitNo: string | null }> }>(
          "/api/v1/assets?ownershipType=OWNER",
        ),
      ]);
      setSchedules(Array.isArray(schedData) ? schedData : []);
      setExpenses(Array.isArray(expData) ? expData : []);
      setAssets(Array.isArray(assetRes?.items) ? assetRes.items : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-slate-900">งวดค่าเช่ารายเดือนห้อง Owner & ค่าใช้จ่าย</h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowStandalonePay(true)}
            className="rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-emerald-700"
          >
            + บันทึกรับ/จ่ายเงิน
          </button>
          <button
            type="button"
            onClick={() => setShowExpenseModal(true)}
            className="rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-700"
          >
            + บันทึกค่าใช้จ่าย
          </button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border bg-white p-8 text-center text-sm text-slate-500">กำลังโหลดข้อมูล...</div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
            <div className="border-b bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-800">
              ตารางงวดค่าเช่ารายเดือน ({schedules.length})
            </div>
            {schedules.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">ยังไม่มีงวดค่าเช่า</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b bg-slate-50/60 text-slate-600">
                    <tr>
                      <th className="px-3 py-2">สัญญา / ห้อง</th>
                      <th className="px-3 py-2">ครบกำหนด</th>
                      <th className="px-3 py-2 text-right">ยอดเรียกเก็บ</th>
                      <th className="px-3 py-2 text-right">รับแล้ว</th>
                      <th className="px-3 py-2">สถานะ</th>
                      <th className="px-3 py-2 text-right">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {schedules.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2">
                          <div className="font-semibold text-slate-900">{s.contract.contractNo}</div>
                          <div className="text-slate-500">{s.contract.asset.code}</div>
                        </td>
                        <td className="px-3 py-2 text-slate-700">{s.dueDate.slice(0, 10)}</td>
                        <td className="px-3 py-2 text-right font-medium">{formatDecimalBaht(s.amountDue)}</td>
                        <td className="px-3 py-2 text-right text-emerald-700">{formatDecimalBaht(s.amountPaid)}</td>
                        <td className="px-3 py-2">
                          <span className={`rounded-full px-2 py-0.5 font-medium ${SCHEDULE_STATUS_COLORS[s.status]}`}>
                            {SCHEDULE_STATUS_LABELS[s.status]}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          {s.status !== "PAID" && s.status !== "WAIVED" && (
                            <button
                              type="button"
                              onClick={() => setPaySchedule(s)}
                              className="rounded bg-emerald-600 px-2.5 py-1 text-white hover:bg-emerald-700"
                            >
                              รับชำระ
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

          <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
            <div className="border-b bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-800">
              รายการค่าใช้จ่ายต่อทรัพย์สิน ({expenses.length})
            </div>
            {expenses.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">ยังไม่มีรายการค่าใช้จ่าย</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b bg-slate-50/60 text-slate-600">
                    <tr>
                      <th className="px-3 py-2">วันที่</th>
                      <th className="px-3 py-2">ห้อง</th>
                      <th className="px-3 py-2">หมวดค่าใช้จ่าย</th>
                      <th className="px-3 py-2 text-right">จำนวนเงิน</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {expenses.map((ex) => (
                      <tr key={ex.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-700">{ex.incurredAt.slice(0, 10)}</td>
                        <td className="px-3 py-2 font-medium text-slate-900">{ex.asset.code}</td>
                        <td className="px-3 py-2 text-slate-700">{EXPENSE_CATEGORY_LABELS[ex.category]}</td>
                        <td className="px-3 py-2 text-right font-semibold text-rose-700">
                          {formatDecimalBaht(ex.amount)} ฿
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {(paySchedule || showStandalonePay) && (
        <RecordPaymentModal
          schedule={paySchedule}
          onClose={() => {
            setPaySchedule(null);
            setShowStandalonePay(false);
          }}
          onSuccess={() => void loadData()}
        />
      )}

      {showExpenseModal && (
        <RecordExpenseModal
          assets={assets}
          onClose={() => setShowExpenseModal(false)}
          onSuccess={() => void loadData()}
        />
      )}
    </div>
  );
}
