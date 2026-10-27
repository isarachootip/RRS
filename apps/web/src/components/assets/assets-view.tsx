"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { ASSET_CATEGORIES, type AssetCategory } from "@rrs/shared";
import Link from "next/link";
import { useState } from "react";
import { type MessageKey, t } from "@/i18n/th";
import { api } from "@/lib/api";
import { AssetFormModal } from "./asset-form-modal";
import { BulkApartmentModal } from "./bulk-apartment-modal";

export interface AssetRow {
  id: string;
  code: string;
  category: AssetCategory;
  ownershipType: "OWNER" | "AGENT";
  unitNo: string | null;
  status: string;
  rentPrice: string | null;
  minRentPrice: string | null;
  project?: { id: string; name: string } | null;
  primaryAgent?: { id: string; fullName: string } | null;
}

const col = createColumnHelper<AssetRow>();

const columns = [
  col.accessor("code", {
    header: "รหัส",
    cell: (info) => (
      <Link href={`/assets/${info.row.original.id}`} className="font-mono text-xs font-semibold text-brand underline">
        {info.getValue()}
      </Link>
    ),
  }),
  col.accessor("category", {
    header: "ประเภท",
    cell: (info) => t(`assets.cat.${info.getValue()}` as MessageKey),
  }),
  col.accessor((row) => row.project?.name ?? "-", { id: "projectName", header: "โครงการ" }),
  col.accessor((row) => row.unitNo ?? "-", { id: "unitNo", header: "เลขห้อง/บ้าน" }),
  col.accessor((row) => row.rentPrice ?? "-", { id: "rentPrice", header: "ค่าเช่า (บาท)" }),
  col.accessor("status", {
    header: "สถานะ",
    cell: (info) => (
      <span className="rounded bg-surface-subtle px-2 py-0.5 text-xs font-medium text-ink">{info.getValue()}</span>
    ),
  }),
];

export function AssetsView() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showBulk, setShowBulk] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["assets", search, category],
    queryFn: () => {
      const qs = new URLSearchParams({ pageSize: "30" });
      if (search.trim()) qs.set("search", search.trim());
      if (category) qs.set("category", category);
      return api<{ items: AssetRow[]; total: number }>(`/api/v1/assets?${qs.toString()}`);
    },
  });

  const items = data?.items ?? [];
  const table = useReactTable({ data: items, columns, getCoreRowModel: getCoreRowModel() });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">{t("assets.title")}</h1>
          <p className="text-sm text-ink-muted">{t("assets.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowBulk(true)}
            className="rounded-md border border-line bg-surface px-3 py-2 text-xs font-medium text-ink"
          >
            {t("assets.bulkAdd")}
          </button>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="rounded-md bg-brand px-4 py-2 text-xs font-medium text-white"
          >
            {t("assets.add")}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          placeholder={t("assets.search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-xs rounded-md border border-line bg-surface px-3 py-2 text-sm"
        />
        <select
          aria-label="กรองประเภทสินทรัพย์"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-md border border-line bg-surface px-3 py-2 text-sm"
        >
          <option value="">ทุกประเภทสินทรัพย์</option>
          {ASSET_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(`assets.cat.${c}` as MessageKey)}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <p className="text-sm text-ink-muted">กำลังโหลด...</p>
      ) : items.length === 0 ? (
        <p className="rounded-lg border border-line bg-surface p-6 text-sm text-ink-muted">{t("assets.empty")}</p>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-lg border border-line bg-surface md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-surface-subtle text-xs text-ink-muted">
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id}>
                    {hg.headers.map((h) => (
                      <th key={h.id} className="px-4 py-3 font-medium">
                        {flexRender(h.column.columnDef.header, h.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-line">
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="hover:bg-surface-subtle">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 md:hidden">
            {items.map((a) => (
              <Link
                key={a.id}
                href={`/assets/${a.id}`}
                className="block space-y-1 rounded-lg border border-line bg-surface p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold text-brand">{a.code}</span>
                  <span className="rounded bg-surface-subtle px-2 py-0.5 text-xs">{a.status}</span>
                </div>
                <p className="font-medium text-ink">
                  {t(`assets.cat.${a.category}` as MessageKey)} · ห้อง {a.unitNo ?? "-"}
                </p>
                <p className="text-xs text-ink-muted">ค่าเช่า: {a.rentPrice ?? "-"} บาท/เดือน</p>
              </Link>
            ))}
          </div>
        </>
      )}

      {showAdd && (
        <AssetFormModal
          onClose={() => setShowAdd(false)}
          onSaved={() => {
            setShowAdd(false);
            void queryClient.invalidateQueries({ queryKey: ["assets"] });
          }}
        />
      )}

      {showBulk && (
        <BulkApartmentModal
          onClose={() => setShowBulk(false)}
          onSaved={() => {
            setShowBulk(false);
            void queryClient.invalidateQueries({ queryKey: ["assets"] });
          }}
        />
      )}
    </div>
  );
}
