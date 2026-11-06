import type { Locale } from "@/i18n/dictionaries";

export interface PublicListingItem {
  id: string;
  slug: string;
  type: "RENT" | "SALE";
  price: number;
  titleTh: string;
  titleEn: string | null;
  descriptionTh: string | null;
  descriptionEn: string | null;
  publishedAt: string | null;
  viewCount: number;
  asset: {
    code: string;
    category: string;
    tower: string | null;
    floor: number | null;
    district: string | null;
    province: string | null;
    areaSqm: number | null;
    roomType: string | null;
    bedrooms: number | null;
    bathrooms: number | null;
    furniture: string | null;
    appliances: string[];
    petAllowed: boolean;
    attributes: Record<string, unknown>;
    location: {
      latitude: number | null;
      longitude: number | null;
      approximateLocation: boolean;
    };
    project: {
      id: string;
      name: string;
      nameEn: string | null;
      district: string | null;
      province: string | null;
      nearTransit: string[];
    } | null;
    media: Array<{
      id: string;
      fileId: string;
      url: string;
      caption: string | null;
      isCover: boolean;
      sortOrder: number;
    }>;
    agent: {
      id: string;
      fullName: string;
    } | null;
  };
}

export const FALLBACK_LISTINGS: PublicListingItem[] = [
  {
    id: "00000000-0000-0000-0000-000000000201",
    slug: "lagoon-residences-thonglor-condo-rent",
    type: "RENT",
    price: 35000,
    titleTh: "คอนโดหรู ทองหล่อ 2 ห้องนอน ใกล้ BTS ทองหล่อ",
    titleEn: "Luxury 2-Bed Condo near BTS Thonglor",
    descriptionTh: "แต่งครบพร้อมเข้าอยู่ วิวเมือง ชั้นสูง เดินไป BTS ทองหล่อเพียง 300 เมตร",
    descriptionEn: "Fully furnished high-floor 2-bedroom unit, 300m to BTS Thonglor.",
    publishedAt: "2026-11-01T08:00:00.000Z",
    viewCount: 42,
    asset: {
      code: "PR-000101",
      category: "CONDO",
      tower: "Tower A",
      floor: 18,
      district: "วัฒนา",
      province: "กรุงเทพมหานคร",
      areaSqm: 65,
      roomType: "TWO_BEDROOMS",
      bedrooms: 2,
      bathrooms: 2,
      furniture: "ครบชุด (Fully Furnished)",
      appliances: ["แอร์", "ทีวี", "ตู้เย็น", "เครื่องซักผ้า"],
      petAllowed: true,
      attributes: { commonFeePerSqm: 65, parkingSlots: 1, facing: "ทิศใต้" },
      location: { latitude: 13.7245, longitude: 100.5785, approximateLocation: false },
      project: {
        id: "00000000-0000-0000-0000-000000000301",
        name: "ลากูน เรสซิเดนซ์ ทองหล่อ",
        nameEn: "Lagoon Residences Thonglor",
        district: "วัฒนา",
        province: "กรุงเทพมหานคร",
        nearTransit: ["BTS ทองหล่อ"],
      },
      media: [],
      agent: { id: "00000000-0000-0000-0000-000000000401", fullName: "ทีมที่ปรึกษา RRS" },
    },
  },
];

export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    return process.env.NEXT_PUBLIC_API_URL || "/api/v1";
  }
  return process.env.NEXT_PUBLIC_API_URL || `${process.env.INTERNAL_API_URL ?? "https://rrs.tamadee.online"}/api/v1`;
}

export async function fetchPublicListings(
  query: Record<string, string | undefined> = {},
): Promise<{ total: number; items: PublicListingItem[] }> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v) qs.set(k, v);
  }
  try {
    const res = await fetch(`${getApiBaseUrl()}/public/listings?${qs.toString()}`, {
      cache: "no-store",
    });
    if (res.ok) {
      const data = (await res.json()) as { total: number; items: PublicListingItem[] };
      if (data.items.length > 0 || Object.keys(query).length > 0) return data;
    }
  } catch {
    // Use fallback when backend is offline during static/unit render
  }
  return { total: FALLBACK_LISTINGS.length, items: FALLBACK_LISTINGS };
}

export async function fetchPublicListingBySlug(
  slug: string,
): Promise<{ listing: PublicListingItem; nearby: PublicListingItem[] } | null> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/public/listings/${encodeURIComponent(slug)}`, {
      cache: "no-store",
    });
    if (res.ok) {
      return (await res.json()) as { listing: PublicListingItem; nearby: PublicListingItem[] };
    }
  } catch {
    // Fallback check below
  }
  const found = FALLBACK_LISTINGS.find((x) => x.slug === slug);
  if (!found) return null;
  return { listing: found, nearby: [] };
}

export function buildListingJsonLd(item: PublicListingItem, locale: Locale): Record<string, unknown> {
  const title = locale === "th" ? item.titleTh : item.titleEn || item.titleTh;
  const description = locale === "th" ? item.descriptionTh : item.descriptionEn || item.descriptionTh;
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: title,
    description: description ?? title,
    url: `https://rrs.co.th/${locale}/listings/${item.slug}`,
    datePosted: item.publishedAt ?? "2026-11-01T00:00:00.000Z",
    offers: {
      "@type": "Offer",
      price: item.price,
      priceCurrency: "THB",
      availability: "https://schema.org/InStock",
    },
  };
}
