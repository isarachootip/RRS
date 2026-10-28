"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import Link from "next/link";
import { useMemo, useState } from "react";
import { LeadFormModal } from "@/components/leads/lead-form-modal";
import { LeadsKanban, PIPELINE_STATUSES, type LeadItem } from "@/components/leads/leads-kanban";
import { t, type MessageKey } from "@/i18n/th";
import { api } from "@/lib/api";

interface LeadsResponse {
  items: LeadItem[];
  total: number;
}

const columnHelper = createColumnHelper<LeadItem>();

export function LeadsView() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [intent, setIntent] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "kanban">("table");
  const [modalOpen, setModalOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["leads", q, status, intent],
    queryFn: () => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (status) params.set("status", status);
      if (intent) params.set("intent", intent);
      return api<LeadsResponse>(`/api/v1/leads?${params.toString()}`);
    },
  });

  const columns = useMemo(
    () => [
      columnHelper.accessor("code", { header: "รหัส" }),
      columnHelper.accessor("fullName", {
        header: "ชื่อ-นามสกุล",
        cell: (info) => (
          <Link href={`/leads/${info.row.original.id}`} className="font-medium text-brand hover:underline">
            {info.getValue()}
          </Link>
        ),
      }),
      columnHelper.accessor("intent", {
        header: "ความต้องการ",
        cell: (info) => t(`leads.intent.${info.getValue()}` as MessageKey),
      }),
      columnHelper.accessor("phone", {
        header: "เบอร์โทร",
        cell: (info) => info.getValue() ?? "-",
      }),
      columnHelper.accessor("status", {
        header: "สถานะ",
        cell: (info) => t(`leads.status.${info.getValue()}` as MessageKey),
      }),
      columnHelper.display({
        id: "ownerAgent",
        header: "ผู้ดูแล",
        cell: (info) => info.row.original.ownerAgent?.fullName ?? "-",
      }),
    ],
    [],
  );

  const table = useReactTable({
    data: data?.items ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["leads"] });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">{t("leads.title")}</h1>
          <p className="text-sm text-ink-muted">{t("leads.subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setViewMode(viewMode === "table" ? "kanban" : "table")}
            className="rounded border border-line bg-surface px-3 py-2 text-sm text-ink"
          >
            {viewMode === "table" ? t("leads.view.kanban") : t("leads.view.table")}
          </button>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="rounded bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            {t("leads.add")}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          placeholder={t("leads.search")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="min-w-[220px] flex-1 rounded border border-line bg-surface px-3 py-2 text-sm text-ink"
        />
        <select
          aria-label="กรองความต้องการ"
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          className="rounded border border-line bg-surface px-3 py-2 text-sm text-ink"
        >
          <option value="">ทุกความต้องการ</option>
          <option value="RENT">{t("leads.intent.RENT")}</option>
          <option value="BUY">{t("leads.intent.BUY")}</option>
        </select>
        <select
          aria-label="กรองสถานะลูกค้า"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded border border-line bg-surface px-3 py-2 text-sm text-ink"
        >
          <option value="">ทุกสถานะ</option>
          {PIPELINE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`leads.status.${s}` as MessageKey)}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <p className="text-sm text-ink-muted">กำลังโหลด...</p>
      ) : viewMode === "kanban" ? (
        <LeadsKanban items={data?.items ?? []} onChanged={refresh} />
      ) : (data?.items.length ?? 0) === 0 ? (
        <div className="rounded-lg border border-line bg-surface p-8 text-center text-sm text-ink-muted">
          {t("leads.empty")}
        </div>
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
                    <td key={cell.id} className="px-4 py-3 text-ink">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <LeadFormModal open={modalOpen} onClose={() => setModalOpen(false)} onSaved={refresh} />
    </div>
  );
}
