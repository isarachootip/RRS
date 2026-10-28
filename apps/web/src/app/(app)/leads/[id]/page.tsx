"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { ConfirmArchiveDialog } from "@/components/confirm-archive-dialog";
import { ForbiddenState } from "@/components/forbidden-state";
import {
  LeadDetailPanels,
  type LeadActivityItem,
  type LeadAssignmentItem,
  type LeadCollaboratorItem,
} from "@/components/leads/lead-detail-panels";
import { Timeline } from "@/components/timeline";
import { t, type MessageKey } from "@/i18n/th";
import { ApiError, api } from "@/lib/api";

interface LeadDetail {
  id: string;
  code: string;
  intent: "RENT" | "BUY";
  fullName: string;
  phone: string | null;
  lineId: string | null;
  email: string | null;
  status: string;
  statusReason: string | null;
  budgetMin: string | number | null;
  budgetMax: string | number | null;
  preferredLocation: string | null;
  ownerAgent?: { id: string; fullName: string };
  activities?: LeadActivityItem[];
  assignments?: LeadAssignmentItem[];
  collaborators?: LeadCollaboratorItem[];
}

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
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

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["lead", id] });

  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-lg border border-line bg-surface p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-ink-muted">
              {data.code} · {t(`leads.intent.${data.intent ?? "RENT"}` as MessageKey)}
            </p>
            <h1 className="text-xl font-semibold text-ink">{data.fullName}</h1>
            <p className="text-sm text-ink-muted">เบอร์โทรศัพท์: {data.phone ?? "-"}</p>
            <p className="text-xs text-ink-muted">
              สถานะ: {t(`leads.status.${data.status}` as MessageKey)} · ผู้ดูแล: {data.ownerAgent?.fullName ?? "-"}
            </p>
          </div>
          <ConfirmArchiveDialog
            itemLabel={data.fullName}
            onConfirm={async () => {
              await api(`/api/v1/leads/${data.id}/archive`, { method: "POST" });
              router.push("/leads");
            }}
          />
        </div>
      </div>

      <LeadDetailPanels
        leadId={data.id}
        activities={data.activities ?? []}
        assignments={data.assignments ?? []}
        collaborators={data.collaborators ?? []}
        onRefresh={refresh}
      />

      <Timeline entityType="lead" entityId={data.id} />
    </div>
  );
}
