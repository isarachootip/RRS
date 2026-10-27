"use client";

import { useQuery } from "@tanstack/react-query";
import { t } from "@/i18n/th";
import { api } from "@/lib/api";

export interface AuditLogItem {
  id: string;
  action: string;
  actorId: string | null;
  actorName: string | null;
  createdAt: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

interface TimelineProps {
  entityType: string;
  entityId: string;
}

interface DiffField {
  key: string;
  beforeVal: string;
  afterVal: string;
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return "-";
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

function extractDiffs(before: Record<string, unknown> | null, after: Record<string, unknown> | null): DiffField[] {
  const keys = new Set<string>([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  const ignoredKeys = new Set(["updatedAt", "createdAt"]);
  const diffs: DiffField[] = [];

  for (const key of keys) {
    if (ignoredKeys.has(key)) continue;
    const bVal = before ? before[key] : undefined;
    const aVal = after ? after[key] : undefined;
    if (JSON.stringify(bVal) !== JSON.stringify(aVal)) {
      diffs.push({
        key,
        beforeVal: formatValue(bVal),
        afterVal: formatValue(aVal),
      });
    }
  }
  return diffs;
}

function formatBangkokDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("th-TH", {
      timeZone: "Asia/Bangkok",
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function Timeline({ entityType, entityId }: TimelineProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", entityType, entityId],
    queryFn: () =>
      api<{ items: AuditLogItem[] }>(
        `/api/v1/audit-logs?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`,
      ),
    enabled: Boolean(entityType && entityId),
  });

  const items = data?.items ?? [];

  return (
    <section aria-label={t("timeline.title")} className="space-y-4 rounded-lg border border-line bg-surface p-6">
      <h2 className="text-base font-semibold text-ink">{t("timeline.title")}</h2>

      {isLoading ? (
        <p className="text-sm text-ink-muted">{t("timeline.loading")}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-ink-muted">{t("timeline.empty")}</p>
      ) : (
        <ol className="space-y-4 border-l-2 border-line pl-4">
          {items.map((item) => {
            const diffs = extractDiffs(item.before, item.after);
            return (
              <li key={item.id} className="space-y-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-surface-subtle px-2 py-0.5 text-xs font-semibold text-ink">
                    {item.action}
                  </span>
                  <span className="font-medium text-ink">{item.actorName ?? t("timeline.actor.system")}</span>
                  <span className="text-xs text-ink-muted">{formatBangkokDate(item.createdAt)}</span>
                </div>

                {diffs.length > 0 && (
                  <div className="space-y-1 rounded-md border border-line bg-surface-subtle p-3 text-xs">
                    {diffs.map((d) => (
                      <div key={d.key} className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono font-semibold text-ink">{d.key}:</span>
                        <span className="line-through text-ink-muted">{d.beforeVal}</span>
                        <span className="text-ink-muted">→</span>
                        <span className="font-medium text-ink">{d.afterVal}</span>
                      </div>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
