"use client";

import { FileSignature } from "lucide-react";
import { useState } from "react";
import { BookingsView } from "../bookings/bookings-view";
import { ContractsTab } from "./contracts-tab";
import { SaleDealsTab } from "./sale-deals-tab";

type DealsTabKey = "bookings" | "contracts" | "sales";

const TABS: Array<{ key: DealsTabKey; label: string }> = [
  { key: "bookings", label: "การจองห้องเช่า (Bookings)" },
  { key: "contracts", label: "สัญญาเช่า (Lease Contracts)" },
  { key: "sales", label: "งานขาย (Sale Pipeline)" },
];

export function DealsWorkspace() {
  const [activeTab, setActiveTab] = useState<DealsTabKey>("bookings");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-2">
          <FileSignature className="h-6 w-6 text-blue-600" />
          <span className="text-lg font-bold text-slate-900">ดีล การจอง สัญญาเช่า และงานขาย</span>
        </div>
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
                activeTab === t.key ? "bg-blue-600 text-white" : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "bookings" && <BookingsView />}
      {activeTab === "contracts" && <ContractsTab />}
      {activeTab === "sales" && <SaleDealsTab />}
    </div>
  );
}
