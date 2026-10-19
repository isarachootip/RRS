"use client";

import { useQuery } from "@tanstack/react-query";
import { t } from "@/i18n/th";
import { api } from "@/lib/api";

export function ApiStatus() {
  const { isPending, isError } = useQuery({
    queryKey: ["health"],
    queryFn: () => api<{ status: string }>("/health"),
    refetchInterval: 60_000,
    retry: 0,
  });
  const label = isPending ? t("api.checking") : isError ? t("api.down") : t("api.up");
  const color = isPending ? "bg-status-unavailable" : isError ? "bg-status-booked" : "bg-status-available";
  return (
    <span className="flex items-center gap-2 text-sm text-ink-muted" role="status" title={label}>
      <span aria-hidden className={`size-2 rounded-full ${color}`} />
      <span className={isError ? "max-sm:sr-only" : "sr-only"}>{label}</span>
    </span>
  );
}
