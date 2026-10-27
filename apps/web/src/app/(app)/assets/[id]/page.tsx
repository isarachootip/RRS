"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import {
  type AssetAgentItem,
  type AssetMediaItem,
  AssetRelationsPanel,
  type ListingAgreementItem,
} from "@/components/assets/asset-relations-panel";
import { ConfirmArchiveDialog } from "@/components/confirm-archive-dialog";
import { ForbiddenState } from "@/components/forbidden-state";
import { Timeline } from "@/components/timeline";
import { ApiError, api } from "@/lib/api";

interface AssetDetail {
  id: string;
  code: string;
  category: string;
  unitNo: string | null;
  status: string;
  rentPrice: string | null;
  minRentPrice: string | null;
  internalNote: string | null;
  media?: AssetMediaItem[];
  agents?: AssetAgentItem[];
  agreements?: ListingAgreementItem[];
}

export default function AssetDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const queryClient = useQueryClient();

  const { data, error, isLoading } = useQuery({
    queryKey: ["asset", id],
    queryFn: () => api<AssetDetail>(`/api/v1/assets/${id}`),
    enabled: Boolean(id),
    retry: false,
  });

  if (isLoading) {
    return <p className="text-sm text-ink-muted">กำลังโหลดข้อมูลทรัพย์สิน...</p>;
  }

  if (error instanceof ApiError && error.statusCode === 403) {
    return <ForbiddenState message={error.message} />;
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-line bg-surface p-6">
        <p className="text-sm text-ink-muted">ไม่พบข้อมูลทรัพย์สินรายการนี้</p>
      </div>
    );
  }

  async function toggleUnavailable() {
    if (!data) return;
    const nextStatus = data.status === "UNAVAILABLE" ? "AVAILABLE" : "UNAVAILABLE";
    await api(`/api/v1/assets/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: nextStatus }),
    });
    await queryClient.invalidateQueries({ queryKey: ["asset", id] });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-line bg-surface p-6">
        <div className="space-y-2">
          <p className="text-xs font-medium text-ink-muted">
            {data.code} · {data.category} ({data.status})
          </p>
          <h1 className="text-xl font-semibold text-ink">ห้อง {data.unitNo ?? data.code}</h1>
          <p className="text-sm text-ink-muted">
            ค่าเช่า: {data.rentPrice ?? "-"} บาท/เดือน
            {data.minRentPrice ? ` (ราคาต่ำสุด: ${data.minRentPrice})` : ""}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {(data.status === "AVAILABLE" || data.status === "UNAVAILABLE") && (
            <button
              type="button"
              onClick={() => void toggleUnavailable()}
              className="rounded-md border border-line bg-surface-subtle px-3 py-1.5 text-xs font-medium text-ink"
            >
              {data.status === "UNAVAILABLE" ? "เปิดเป็นห้องว่าง" : "ปิดชั่วคราว (ไม่ว่าง)"}
            </button>
          )}
          <ConfirmArchiveDialog
            itemLabel={data.code}
            onConfirm={async () => {
              await api(`/api/v1/assets/${id}/archive`, { method: "POST" });
              await queryClient.invalidateQueries({ queryKey: ["asset", id] });
            }}
          />
        </div>
      </div>

      <AssetRelationsPanel
        assetId={data.id}
        media={data.media ?? []}
        agents={data.agents ?? []}
        agreements={data.agreements ?? []}
      />

      <Timeline entityType="asset" entityId={data.id} />
    </div>
  );
}
