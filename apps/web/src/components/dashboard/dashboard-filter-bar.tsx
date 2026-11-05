"use client";

import {
  ASSET_CATEGORY_LABELS,
  type DealTypeFilter,
  type FilterOptionsResponse,
  type ReportFilterState,
  type ReportGranularity,
  type ReportGroupBy,
} from "./dashboard.types";

export function DashboardFilterBar({
  filters,
  setFilters,
  options,
  showGroupControls = false,
}: {
  filters: ReportFilterState;
  setFilters: React.Dispatch<React.SetStateAction<ReportFilterState>>;
  options: FilterOptionsResponse;
  showGroupControls?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 rounded-lg border bg-white p-4 text-xs shadow-sm md:grid-cols-6">
      <label className="font-medium text-gray-700">
        ตั้งแต่วันที่
        <input
          type="date"
          aria-label="ตั้งแต่วันที่"
          value={filters.startDate}
          onChange={(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value }))}
          className="mt-1 w-full rounded border px-2 py-1.5"
        />
      </label>
      <label className="font-medium text-gray-700">
        ถึงวันที่
        <input
          type="date"
          aria-label="ถึงวันที่"
          value={filters.endDate}
          onChange={(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value }))}
          className="mt-1 w-full rounded border px-2 py-1.5"
        />
      </label>
      <label className="font-medium text-gray-700">
        ทีมงาน
        <select
          aria-label="กรองตามทีม"
          value={filters.teamId}
          onChange={(e) => setFilters((prev) => ({ ...prev, teamId: e.target.value }))}
          className="mt-1 w-full rounded border px-2 py-1.5"
        >
          <option value="">ทุกทีม</option>
          {options.teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <label className="font-medium text-gray-700">
        โครงการ
        <select
          aria-label="กรองตามโครงการ"
          value={filters.projectId}
          onChange={(e) => setFilters((prev) => ({ ...prev, projectId: e.target.value }))}
          className="mt-1 w-full rounded border px-2 py-1.5"
        >
          <option value="">ทุกโครงการ</option>
          {options.projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label className="font-medium text-gray-700">
        ประเภททรัพย์สิน
        <select
          aria-label="กรองตามประเภททรัพย์สิน"
          value={filters.category}
          onChange={(e) => setFilters((prev) => ({ ...prev, category: e.target.value }))}
          className="mt-1 w-full rounded border px-2 py-1.5"
        >
          <option value="">ทุกประเภท</option>
          {Object.entries(ASSET_CATEGORY_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="font-medium text-gray-700">
        ประเภทธุรกรรม
        <select
          aria-label="กรองเช่าหรือขาย"
          value={filters.dealType}
          onChange={(e) => setFilters((prev) => ({ ...prev, dealType: e.target.value as DealTypeFilter }))}
          className="mt-1 w-full rounded border px-2 py-1.5"
        >
          <option value="ALL">เช่า + ขาย</option>
          <option value="RENT">เฉพาะเช่า</option>
          <option value="SALE">เฉพาะขาย</option>
        </select>
      </label>

      {showGroupControls && (
        <>
          <label className="font-medium text-gray-700">
            จัดกลุ่มรายงานตาม
            <select
              aria-label="จัดกลุ่มรายงานตาม"
              value={filters.groupBy}
              onChange={(e) => setFilters((prev) => ({ ...prev, groupBy: e.target.value as ReportGroupBy }))}
              className="mt-1 w-full rounded border px-2 py-1.5"
            >
              <option value="PERIOD">ตามช่วงเวลา (วัน/เดือน/ปี)</option>
              <option value="OWNERSHIP">ตามประเภทห้อง (Owner / Agent)</option>
              <option value="PROJECT">ตามโครงการ</option>
              <option value="AGENT">ตาม Agent รายบุคคล</option>
              <option value="CONTRACT_DEAL">ตามสัญญา / ดีล</option>
            </select>
          </label>
          {filters.groupBy === "PERIOD" && (
            <label className="font-medium text-gray-700">
              ความละเอียดเวลา
              <select
                aria-label="ความละเอียดเวลา"
                value={filters.granularity}
                onChange={(e) => setFilters((prev) => ({ ...prev, granularity: e.target.value as ReportGranularity }))}
                className="mt-1 w-full rounded border px-2 py-1.5"
              >
                <option value="DAY">รายวัน</option>
                <option value="MONTH">รายเดือน</option>
                <option value="YEAR">รายปี</option>
              </select>
            </label>
          )}
        </>
      )}
    </div>
  );
}
