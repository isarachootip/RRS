import type { Prisma } from "@rrs/db";
import type { PublicListingCardDto, PublicListingLocationDto } from "./listings.types";

const APPROXIMATE_LOCATION_CATEGORIES = new Set(["HOUSE", "TOWNHOME", "LAND"]);
const FORBIDDEN_ATTRIBUTE_KEYS = new Set([
  "deedNo",
  "unitNo",
  "address",
  "owner",
  "ownerId",
  "internalNote",
  "minRentPrice",
  "minSalePrice",
]);

export const PUBLIC_LISTING_SELECT = {
  id: true,
  slug: true,
  type: true,
  price: true,
  titleTh: true,
  titleEn: true,
  descriptionTh: true,
  descriptionEn: true,
  publishedAt: true,
  viewCount: true,
  asset: {
    select: {
      id: true,
      code: true,
      category: true,
      tower: true,
      floor: true,
      district: true,
      province: true,
      latitude: true,
      longitude: true,
      areaSqm: true,
      roomType: true,
      bedrooms: true,
      bathrooms: true,
      furniture: true,
      appliances: true,
      petAllowed: true,
      attributes: true,
      project: {
        select: {
          id: true,
          name: true,
          nameEn: true,
          district: true,
          province: true,
          latitude: true,
          longitude: true,
          nearTransit: true,
        },
      },
      media: {
        orderBy: { sortOrder: "asc" as const },
        select: {
          id: true,
          fileId: true,
          caption: true,
          isCover: true,
          sortOrder: true,
        },
      },
      primaryAgent: {
        select: {
          id: true,
          fullName: true,
        },
      },
    },
  },
} satisfies Prisma.ListingSelect;

export type PublicListingRow = Prisma.ListingGetPayload<{ select: typeof PUBLIC_LISTING_SELECT }>;

export function sanitizePublicAttributes(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (!FORBIDDEN_ATTRIBUTE_KEYS.has(key)) {
      out[key] = val;
    }
  }
  return out;
}

export function buildPublicLocation(
  category: string,
  assetLat: unknown,
  assetLng: unknown,
  projectLat: unknown,
  projectLng: unknown,
): PublicListingLocationDto {
  const rawLat = assetLat ?? projectLat;
  const rawLng = assetLng ?? projectLng;
  const approximate = APPROXIMATE_LOCATION_CATEGORIES.has(category);
  if (rawLat === null || rawLat === undefined || rawLng === null || rawLng === undefined) {
    return { latitude: null, longitude: null, approximateLocation: approximate };
  }
  const latNum = Number(rawLat);
  const lngNum = Number(rawLng);
  if (Number.isNaN(latNum) || Number.isNaN(lngNum)) {
    return { latitude: null, longitude: null, approximateLocation: approximate };
  }
  const factor = approximate ? 100 : 10000;
  return {
    latitude: Math.round(latNum * factor) / factor,
    longitude: Math.round(lngNum * factor) / factor,
    approximateLocation: approximate,
  };
}

export function toPublicListingDto(row: PublicListingRow): PublicListingCardDto {
  const a = row.asset;
  return {
    id: row.id,
    slug: row.slug,
    type: row.type,
    price: Number(row.price),
    titleTh: row.titleTh,
    titleEn: row.titleEn,
    descriptionTh: row.descriptionTh,
    descriptionEn: row.descriptionEn,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    viewCount: row.viewCount,
    asset: {
      code: a.code,
      category: a.category,
      tower: a.tower,
      floor: a.floor,
      district: a.district ?? a.project?.district ?? null,
      province: a.province ?? a.project?.province ?? null,
      areaSqm: a.areaSqm !== null ? Number(a.areaSqm) : null,
      roomType: a.roomType,
      bedrooms: a.bedrooms,
      bathrooms: a.bathrooms,
      furniture: a.furniture,
      appliances: a.appliances,
      petAllowed: a.petAllowed,
      attributes: sanitizePublicAttributes(a.attributes),
      location: buildPublicLocation(a.category, a.latitude, a.longitude, a.project?.latitude, a.project?.longitude),
      project: a.project
        ? {
            id: a.project.id,
            name: a.project.name,
            nameEn: a.project.nameEn,
            district: a.project.district,
            province: a.project.province,
            nearTransit: a.project.nearTransit,
          }
        : null,
      media: a.media.map((m) => ({
        id: m.id,
        fileId: m.fileId,
        url: `/api/v1/files/${m.fileId}/public`,
        caption: m.caption,
        isCover: m.isCover,
        sortOrder: m.sortOrder,
      })),
      agent: a.primaryAgent ? { id: a.primaryAgent.id, fullName: a.primaryAgent.fullName } : null,
    },
  };
}
