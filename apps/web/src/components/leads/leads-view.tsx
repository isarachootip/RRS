"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { ConfirmArchiveDialog } from "@/components/confirm-archive-dialog";
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
  const [archived, setArchived] = useState<"false" | "true">("false");
  const [viewMode, setViewMode] = useState<"table" | "kanban">("table");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<LeadItem | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["leads", q, status, intent, archived],
    queryFn: () => {
      const params = new URLSearchParams();
      if (q.trim()) params.set("search", q.trim());
      if (status) params.set("status", status);
      if (intent) params.set("intent", intent);
      if (archived === "true") params.set("archived", "true");
      return api<LeadsResponse>(`/api/v1/leads?${params.toString()}`);
    },
  });

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["leads"] });
  }, [queryClient]);

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
      columnHelper.accessor("phone", { header: "เบอร์โทร", cell: (info) => info.getValue() ?? "-" }),
      columnHelper.accessor("status", {
        header: "สถานะ",
        cell: (info) => t(`leads.status.${info.getValue()}` as MessageKey) ?? info.getValue(),
      }),
      columnHelper.display({
        id: "ownerAgent",
        header: "ผู้ดูแล",
        cell: (info) => info.row.original.ownerAgent?.fullName ?? "-",
      }),
      columnHelper.display({
        id: "actions",
        header: "จัดการ",
        cell: (info) => {
          const item = info.row.original;
          return (
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/leads/${item.id}`} className="rounded border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink hover:bg-surface-subtle">
                ดู
              </Link>
              <button
                type="button"
                onClick={() => { setEditingLead(item); setModalOpen(true); }}
                className="rounded border border-brand/40 bg-lagoon-soft/50 px-2.5 py-1 text-xs font-medium text-brand hover:bg-lagoon-soft"
              >
                แก้ไข
              </button>
              {archived === "false" && (
                <ConfirmArchiveDialog
                  itemLabel={`${item.code} ${item.fullName}`}
                  buttonLabel="ลบ/เก็บเข้ากรุ"
                  onConfirm={async () => {
                    await api(`/api/v1/leads/${item.id}/archive`, { method: "POST" });
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

  const table = useReactTable({ data: data?.items ?? [], columns, getCoreRowModel: getCoreRowModel() });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">{t("leads.title")}</h1>
          <p className="text-sm text-ink-muted">{t("leads.subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setViewMode(viewMode === "table" ? "kanban" : "table")} className="rounded border border-line bg-surface px-3 py-2 text-sm text-ink">
            {viewMode === "table" ? t("leads.view.kanban") : t("leads.view.table")}
          </button>
          <button type="button" onClick={() => { setEditingLead(null); setModalOpen(true); }} className="rounded bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90">
            + {t("leads.add")}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <input type="search" placeholder={t("leads.search")} value={q} onChange={(e) => setQ(e.target.value)} className="min-w-[220px] flex-1 rounded border border-line bg-surface px-3 py-2 text-sm text-ink" />
        <select aria-label="กรองความต้องการ" value={intent} onChange={(e) => setIntent(e.target.value)} className="rounded border border-line bg-surface px-3 py-2 text-sm text-ink">
          <option value="">ทุกความต้องการ</option>
          <option value="RENT">{t("leads.intent.RENT")}</option>
          <option value="BUY">{t("leads.intent.BUY")}</option>
        </select>
        <select aria-label="กรองสถานะลูกค้า" value={status} onChange={(e) => setStatus(e.target.value)} className="rounded border border-line bg-surface px-3 py-2 text-sm text-ink">
          <option value="">ทุกสถานะ</option>
          {PIPELINE_STATUSES.map((s) => <option key={s} value={s}>{t(`leads.status.${s}` as MessageKey)}</option>)}
        </select>
        <select aria-label="กรองรายการเก็บเข้ากรุ" value={archived} onChange={(e) => setArchived(e.target.value as "false" | "true")} className="rounded border border-line bg-surface px-3 py-2 text-sm text-ink">
          <option value="false">รายการปกติ</option>
          <option value="true">เก็บเข้ากรุแล้ว (Archived)</option>
        </select>
      </div>

      {isLoading ? (
        <p className="text-sm text-ink-muted">กำลังโหลด...</p>
      ) : viewMode === "kanban" ? (
        <LeadsKanban items={data?.items ?? []} onChanged={refresh} />
      ) : (data?.items.length ?? 0) === 0 ? (
        <div className="rounded-lg border border-line bg-surface p-8 text-center text-sm text-ink-muted">{t("leads.empty")}</div>
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
                  {row.getVisibleCells().map((cell) => <td key={cell.id} className="px-4 py-3 text-ink">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <LeadFormModal open={modalOpen} initial={editingLead} onClose={() => { setModalOpen(false); setEditingLead(null); }} onSaved={refresh} />
    </div>
  );
}
