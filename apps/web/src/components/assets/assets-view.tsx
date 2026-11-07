"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { ASSET_CATEGORIES, type AssetCategory } from "@rrs/shared";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { ConfirmArchiveDialog } from "@/components/confirm-archive-dialog";
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
  areaSqm?: string | number | null;
  status: string;
  rentPrice: string | null;
  minRentPrice: string | null;
  salePrice?: string | null;
  attributes?: Record<string, unknown> | null;
  project?: { id: string; name: string } | null;
  primaryAgent?: { id: string; fullName: string } | null;
}

const col = createColumnHelper<AssetRow>();

export function AssetsView() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [archived, setArchived] = useState<"false" | "true">("false");
  const [showAdd, setShowAdd] = useState(false);
  const [editingAsset, setEditingAsset] = useState<AssetRow | null>(null);
  const [showBulk, setShowBulk] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["assets", search, category, archived],
    queryFn: () => {
      const qs = new URLSearchParams({ pageSize: "30" });
      if (search.trim()) qs.set("search", search.trim());
      if (category) qs.set("category", category);
      if (archived === "true") qs.set("archived", "true");
      return api<{ items: AssetRow[]; total: number }>(`/api/v1/assets?${qs.toString()}`);
    },
  });

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["assets"] });
  }, [queryClient]);

  const columns = useMemo(
    () => [
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
      col.display({
        id: "actions",
        header: "จัดการ",
        cell: (info) => {
          const item = info.row.original;
          return (
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/assets/${item.id}`} className="rounded border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink hover:bg-surface-subtle">
                ดู
              </Link>
              <button
                type="button"
                onClick={() => { setEditingAsset(item); setShowAdd(true); }}
                className="rounded border border-brand/40 bg-lagoon-soft/50 px-2.5 py-1 text-xs font-medium text-brand hover:bg-lagoon-soft"
              >
                แก้ไข
              </button>
              {archived === "false" && (
                <ConfirmArchiveDialog
                  itemLabel={`${item.code} ${item.unitNo ?? ""}`}
                  buttonLabel="ลบ/เก็บเข้ากรุ"
                  onConfirm={async () => {
                    await api(`/api/v1/assets/${item.id}/archive`, { method: "POST" });
                    refresh();
                  }}
                />
              )}
            </div>
          );
        },
      }),
    ],
    [archived, refresh],
  );

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
          <button type="button" onClick={() => setShowBulk(true)} className="rounded-md border border-line bg-surface px-3 py-2 text-xs font-medium text-ink">
            {t("assets.bulkAdd")}
          </button>
          <button
            type="button"
            onClick={() => { setEditingAsset(null); setShowAdd(true); }}
            className="rounded-md bg-brand px-4 py-2 text-xs font-medium text-white hover:opacity-90"
          >
            + {t("assets.add")}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <input type="search" placeholder={t("assets.search")} value={search} onChange={(e) => setSearch(e.target.value)} className="w-full max-w-xs rounded-md border border-line bg-surface px-3 py-2 text-sm" />
        <select aria-label="กรองประเภทสินทรัพย์" value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-md border border-line bg-surface px-3 py-2 text-sm">
          <option value="">ทุกประเภทสินทรัพย์</option>
          {ASSET_CATEGORIES.map((c) => <option key={c} value={c}>{t(`assets.cat.${c}` as MessageKey)}</option>)}
        </select>
        <select aria-label="กรองรายการเก็บเข้ากรุ" value={archived} onChange={(e) => setArchived(e.target.value as "false" | "true")} className="rounded-md border border-line bg-surface px-3 py-2 text-sm">
          <option value="false">รายการปกติ</option>
          <option value="true">เก็บเข้ากรุแล้ว (Archived)</option>
        </select>
      </div>

      {isLoading ? (
        <p className="text-sm text-ink-muted">กำลังโหลด...</p>
      ) : items.length === 0 ? (
        <p className="rounded-lg border border-line bg-surface p-6 text-sm text-ink-muted">{t("assets.empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-surface-subtle text-xs text-ink-muted">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((h) => <th key={h.id} className="px-4 py-3 font-medium">{flexRender(h.column.columnDef.header, h.getContext())}</th>)}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-line">
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-surface-subtle">
                  {row.getVisibleCells().map((cell) => <td key={cell.id} className="px-4 py-3">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <AssetFormModal
          initial={editingAsset}
          onClose={() => { setShowAdd(false); setEditingAsset(null); }}
          onSaved={() => { setShowAdd(false); setEditingAsset(null); refresh(); }}
        />
      )}

      {showBulk && (
        <BulkApartmentModal
          onClose={() => setShowBulk(false)}
          onSaved={() => { setShowBulk(false); refresh(); }}
        />
      )}
    </div>
  );
}
