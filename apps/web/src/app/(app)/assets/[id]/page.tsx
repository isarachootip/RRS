"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { ConfirmArchiveDialog } from "@/components/confirm-archive-dialog";
import { ForbiddenState } from "@/components/forbidden-state";
import { Timeline } from "@/components/timeline";
import { ApiError, api } from "@/lib/api";

interface AssetDetail {
  id: string;
  code: string;
  name: string;
  status: string;
  rentPrice: string | null;
  internalNote: string | null;
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-line bg-surface p-6">
        <div className="space-y-2">
          <p className="text-xs font-medium text-ink-muted">{data.code}</p>
          <h1 className="text-xl font-semibold text-ink">{data.name}</h1>
          <p className="text-sm text-ink-muted">ค่าเช่า: {data.rentPrice ?? "-"} บาท/เดือน</p>
        </div>

        <ConfirmArchiveDialog
          itemLabel={data.code}
          onConfirm={async () => {
            await queryClient.invalidateQueries({ queryKey: ["asset", id] });
          }}
        />
      </div>

      <Timeline entityType="asset" entityId={data.id} />
    </div>
  );
}
