"use client";

import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { t } from "@/i18n/th";
import { api } from "@/lib/api";

export interface GlobalSearchResponse {
  owners: Array<{ id: string; code: string; fullName: string; phone: string | null }>;
  assets: Array<{
    id: string;
    code: string;
    unitNo: string | null;
    project?: { name: string } | null;
  }>;
  leads: Array<{ id: string; code: string; fullName: string; phone: string | null }>;
  tookMs: number;
}

export function GlobalSearchBar() {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const trimmed = query.trim();

  const { data, isFetching } = useQuery({
    queryKey: ["global-search", trimmed],
    queryFn: () => api<GlobalSearchResponse>(`/api/v1/search?q=${encodeURIComponent(trimmed)}`),
    enabled: trimmed.length >= 2,
  });

  const hasResults =
    Boolean(data) &&
    ((data?.owners.length ?? 0) > 0 || (data?.assets.length ?? 0) > 0 || (data?.leads.length ?? 0) > 0);

  return (
    <div className="relative min-w-0 flex-1 lg:max-w-xl">
      <label className="relative block w-full">
        <span className="sr-only">{t("topbar.search")}</span>
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted"
        />
        <input
          type="search"
          placeholder={t("topbar.search")}
          value={query}
          onFocus={() => setFocused(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setFocused(true);
          }}
          className="h-9 w-full rounded-md border border-line bg-paper pr-3 pl-9 text-sm placeholder:text-ink-muted focus:border-lagoon focus:bg-surface focus:outline-none"
        />
      </label>

      {focused && trimmed.length >= 2 && (
        <div
          role="region"
          aria-label="ผลการค้นหาทั่วระบบ"
          className="absolute top-11 right-0 left-0 z-50 max-h-96 overflow-y-auto rounded-lg border border-line bg-surface p-3 shadow-xl"
        >
          {isFetching ? (
            <p className="text-xs text-ink-muted">กำลังค้นหา...</p>
          ) : !hasResults ? (
            <p className="text-xs text-ink-muted">ไม่พบข้อมูลที่ตรงกับคำค้นหา</p>
          ) : (
            <div className="space-y-3 text-sm">
              {(data?.assets.length ?? 0) > 0 && (
                <div>
                  <p className="mb-1 text-xs font-semibold text-ink-muted">ทรัพย์สิน</p>
                  <ul className="space-y-1">
                    {data!.assets.map((a) => (
                      <li key={a.id}>
                        <Link
                          href={`/assets/${a.id}`}
                          onClick={() => setFocused(false)}
                          className="block rounded px-2 py-1 hover:bg-surface-subtle"
                        >
                          <span className="font-medium text-brand">{a.code}</span> · ห้อง {a.unitNo ?? "-"} (
                          {a.project?.name ?? "-"})
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {(data?.leads.length ?? 0) > 0 && (
                <div>
                  <p className="mb-1 text-xs font-semibold text-ink-muted">ลูกค้า</p>
                  <ul className="space-y-1">
                    {data!.leads.map((l) => (
                      <li key={l.id}>
                        <Link
                          href={`/leads/${l.id}`}
                          onClick={() => setFocused(false)}
                          className="block rounded px-2 py-1 hover:bg-surface-subtle"
                        >
                          <span className="font-medium text-brand">{l.code}</span> · {l.fullName} ({l.phone ?? "-"})
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {(data?.owners.length ?? 0) > 0 && (
                <div>
                  <p className="mb-1 text-xs font-semibold text-ink-muted">เจ้าของทรัพย์</p>
                  <ul className="space-y-1">
                    {data!.owners.map((o) => (
                      <li key={o.id}>
                        <Link
                          href={`/owners?q=${encodeURIComponent(o.code)}`}
                          onClick={() => setFocused(false)}
                          className="block rounded px-2 py-1 hover:bg-surface-subtle"
                        >
                          <span className="font-medium text-brand">{o.code}</span> · {o.fullName} ({o.phone ?? "-"})
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
