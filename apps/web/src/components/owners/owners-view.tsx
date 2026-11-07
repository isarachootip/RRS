"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useCallback, useMemo, useState } from "react";
import { ConfirmArchiveDialog } from "@/components/confirm-archive-dialog";
import { type MessageKey, t } from "@/i18n/th";
import { api } from "@/lib/api";
import { OwnerFormModal, type OwnerRow } from "./owner-form-modal";

const col = createColumnHelper<OwnerRow>();

export function OwnersView() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [archived, setArchived] = useState<"false" | "true">("false");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<OwnerRow | null | undefined>(undefined);

  const { data, isLoading } = useQuery({
    queryKey: ["owners", search, status, archived, page],
    queryFn: () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (search.trim()) qs.set("search", search.trim());
      if (status) qs.set("status", status);
      if (archived === "true") qs.set("archived", "true");
      return api<{ items: OwnerRow[]; total: number; page: number; pageSize: number }>(
        `/api/v1/owners?${qs.toString()}`,
      );
    },
  });

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["owners"] });
  }, [queryClient]);

  const columns = useMemo(
    () => [
      col.accessor("code", {
        header: "รหัส",
        cell: (info) => <span className="font-mono text-xs font-semibold text-ink">{info.getValue()}</span>,
      }),
      col.accessor("fullName", {
        header: "ชื่อ-นามสกุล",
        cell: (info) => <span className="font-medium text-ink">{info.getValue()}</span>,
      }),
      col.accessor((row) => row.identityNo ?? "-", {
        id: "identityNo",
        header: "เลขบัตร/พาสปอร์ต",
        cell: (info) => <span className="font-mono text-xs text-ink-muted">{info.getValue()}</span>,
      }),
      col.accessor("phone", {
        header: "เบอร์โทร",
        cell: (info) => <span className="text-ink-muted">{info.getValue() ?? "-"}</span>,
      }),
      col.accessor("status", {
        header: "สถานะ",
        cell: (info) => (
          <span className="rounded bg-surface-subtle px-2 py-0.5 text-xs font-medium text-ink">
            {t(`owners.status.${info.getValue()}` as MessageKey)}
          </span>
        ),
      }),
      col.accessor((row) => row.agent?.fullName ?? "-", { id: "agentName", header: "ผู้ดูแล" }),
      col.accessor((row) => row.assetCount ?? 0, { id: "assetCount", header: "จำนวนห้อง" }),
      col.display({
        id: "actions",
        header: "จัดการ",
        cell: (info) => {
          const item = info.row.original;
          return (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setEditing(item)}
                className="rounded border border-brand/40 bg-lagoon-soft/50 px-2.5 py-1 text-xs font-medium text-brand hover:bg-lagoon-soft"
              >
                แก้ไข
              </button>
              {archived === "false" && (
                <ConfirmArchiveDialog
                  itemLabel={`${item.code} ${item.fullName}`}
                  buttonLabel="ลบ/เก็บเข้ากรุ"
                  onConfirm={async () => {
                    await api(`/api/v1/owners/${item.id}/archive`, { method: "POST" });
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
          <h1 className="text-xl font-semibold text-ink">{t("owners.title")}</h1>
          <p className="text-sm text-ink-muted">{t("owners.subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={() => setEditing(null)}
          className="rounded-md bg-brand px-4 py-2 text-xs font-medium text-white hover:opacity-90"
        >
          + {t("owners.add")}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          placeholder={t("owners.search")}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-full max-w-xs rounded-md border border-line bg-surface px-3 py-2 text-sm"
        />
        <select
          aria-label="กรองสถานะเจ้าของทรัพย์"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="rounded-md border border-line bg-surface px-3 py-2 text-sm"
        >
          <option value="">ทุกสถานะ</option>
          <option value="NEW">{t("owners.status.NEW")}</option>
          <option value="CONTACTED">{t("owners.status.CONTACTED")}</option>
          <option value="LISTED">{t("owners.status.LISTED")}</option>
          <option value="INACTIVE">{t("owners.status.INACTIVE")}</option>
        </select>
        <select
          aria-label="กรองรายการเก็บเข้ากรุ"
          value={archived}
          onChange={(e) => {
            setArchived(e.target.value as "false" | "true");
            setPage(1);
          }}
          className="rounded-md border border-line bg-surface px-3 py-2 text-sm"
        >
          <option value="false">รายการปกติ</option>
          <option value="true">เก็บเข้ากรุแล้ว (Archived)</option>
        </select>
      </div>

      {isLoading ? (
        <p className="text-sm text-ink-muted">กำลังโหลด...</p>
      ) : items.length === 0 ? (
        <p className="rounded-lg border border-line bg-surface p-6 text-sm text-ink-muted">{t("owners.empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
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
      )}

      {editing !== undefined && (
        <OwnerFormModal
          initial={editing}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined);
            refresh();
          }}
        />
      )}
    </div>
  );
}
