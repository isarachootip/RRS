"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { t, type MessageKey } from "@/i18n/th";
import { api } from "@/lib/api";

interface PublicOfferAsset {
  offerId: string;
  id: string;
  code: string;
  category: string;
  projectName: string | null;
  district: string | null;
  province: string | null;
  floor: number | null;
  areaSqm: number | null;
  roomType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  furniture: string | null;
  appliances: string[];
  petAllowed: boolean;
  rentPrice: number | null;
  salePrice: number | null;
  offeredPrice: number | null;
  note: string | null;
}

interface PublicOffersResponse {
  shareToken: string;
  expiresAt: string | null;
  items: PublicOfferAsset[];
}

export default function PublicShareOffersPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? "";

  const { data, isLoading, error } = useQuery({
    queryKey: ["public-offers", token],
    queryFn: () => api<PublicOffersResponse>(`/api/v1/public/offers/${token}`),
    enabled: Boolean(token),
    retry: false,
  });

  if (isLoading) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <p className="text-sm text-ink-muted">กำลังโหลดรายการห้องที่แนะนำ...</p>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <div className="rounded-lg border border-line bg-surface p-6 text-center">
          <h1 className="text-base font-semibold text-ink">ลิงก์ไม่ถูกต้องหรือหมดอายุแล้ว</h1>
          <p className="mt-1 text-xs text-ink-muted">กรุณาติดต่อผู้ดูแลของคุณเพื่อขอลิงก์ใหม่อีกครั้ง</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4 sm:p-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-ink">รายการห้องที่คัดสรรสำหรับคุณ</h1>
        <p className="text-xs text-ink-muted">
          จำนวน {data.items.length} รายการ · ลิงก์ใช้ได้ถึง {data.expiresAt?.slice(0, 10) ?? "-"}
        </p>
      </header>

      <div className="space-y-4">
        {data.items.map((item) => (
          <article key={item.offerId} className="space-y-2 rounded-lg border border-line bg-surface p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-brand">{item.code}</span>
              <span className="rounded bg-surface-subtle px-2 py-0.5 text-xs text-ink">
                {t(`assets.cat.${item.category}` as MessageKey)}
              </span>
            </div>
            <h2 className="text-base font-semibold text-ink">
              {item.projectName ?? "ทรัพย์สินแนะนำ"} ({item.district ?? "-"})
            </h2>
            <p className="text-xs text-ink-muted">
              ชั้น {item.floor ?? "-"} · พื้นที่ {item.areaSqm ?? "-"} ตร.ม. · {item.bedrooms ?? 1} ห้องนอน{" "}
              {item.bathrooms ?? 1} ห้องน้ำ · {item.petAllowed ? "เลี้ยงสัตว์ได้" : "ไม่รับสัตว์เลี้ยง"}
            </p>
            <p className="text-sm font-semibold text-ink">
              ราคาเสนอ: {(item.offeredPrice ?? item.rentPrice ?? item.salePrice ?? 0).toLocaleString()} บาท
            </p>
            {item.note && <p className="text-xs text-ink-muted">หมายเหตุ: {item.note}</p>}
          </article>
        ))}
      </div>
    </main>
  );
}
