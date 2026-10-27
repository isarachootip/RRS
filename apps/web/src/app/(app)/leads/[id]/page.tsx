"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { ForbiddenState } from "@/components/forbidden-state";
import { Timeline } from "@/components/timeline";
import { ApiError, api } from "@/lib/api";

interface LeadDetail {
  id: string;
  code: string;
  fullName: string;
  phone: string | null;
  status: string;
}

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";

  const { data, error, isLoading } = useQuery({
    queryKey: ["lead", id],
    queryFn: () => api<LeadDetail>(`/api/v1/leads/${id}`),
    enabled: Boolean(id),
    retry: false,
  });

  if (isLoading) {
    return <p className="text-sm text-ink-muted">กำลังโหลดข้อมูลลูกค้า...</p>;
  }

  if (error instanceof ApiError && error.statusCode === 403) {
    return <ForbiddenState message={error.message} />;
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-line bg-surface p-6">
        <p className="text-sm text-ink-muted">ไม่พบข้อมูลลูกค้ารายนี้</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-lg border border-line bg-surface p-6">
        <p className="text-xs font-medium text-ink-muted">{data.code}</p>
        <h1 className="text-xl font-semibold text-ink">{data.fullName}</h1>
        <p className="text-sm text-ink-muted">เบอร์โทรศัพท์: {data.phone ?? "-"}</p>
      </div>

      <Timeline entityType="lead" entityId={data.id} />
    </div>
  );
}
