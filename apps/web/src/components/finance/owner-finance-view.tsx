"use client";

import { useState } from "react";
import { OwnerNetIncomeTab } from "./owner-net-income-tab";
import { SchedulesAndExpensesTab } from "./schedules-expenses-tab";

type FinanceTabKey = "report" | "schedules";

export function OwnerFinanceView() {
  const [activeTab, setActiveTab] = useState<FinanceTabKey>("report");

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">รายงานและการเงินห้อง Owner</h1>
          <p className="text-sm text-slate-600">
            ติดตามรายได้สุทธิต่อห้องต่อเดือน (Cash Basis), งวดค่าเช่ารายเดือน และค่าใช้จ่ายต่อทรัพย์สิน
          </p>
        </div>
        <div className="flex rounded-lg border bg-white p-1 shadow-sm" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "report"}
            onClick={() => setActiveTab("report")}
            className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition ${
              activeTab === "report" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            รายงานรายได้สุทธิ (Owner)
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "schedules"}
            onClick={() => setActiveTab("schedules")}
            className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition ${
              activeTab === "schedules" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            งวดค่าเช่า & ค่าใช้จ่าย
          </button>
        </div>
      </div>

      {activeTab === "report" && <OwnerNetIncomeTab />}
      {activeTab === "schedules" && <SchedulesAndExpensesTab />}
    </div>
  );
}
