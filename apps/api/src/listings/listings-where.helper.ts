import type { Prisma } from "@rrs/db";
import type { ListPublicListingsQuery } from "./listings.types";

export const BACKOFFICE_LISTING_INCLUDE = {
  asset: {
    select: {
      id: true,
      code: true,
      category: true,
      status: true,
      district: true,
      province: true,
      rentPrice: true,
      salePrice: true,
      project: { select: { id: true, name: true } },
      primaryAgent: { select: { id: true, fullName: true } },
    },
  },
  approvedBy: { select: { id: true, fullName: true } },
} satisfies Prisma.ListingInclude;

export function slugifyListing(rawSlug: string | undefined, title: string, assetCode: string, type: string): string {
  const source = (rawSlug?.trim() || `${title}-${assetCode}-${type}`).toLowerCase();
  const cleaned = source
    .replace(/[^a-z0-9ก-๙\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 140);
  return cleaned || `${assetCode.toLowerCase()}-${type.toLowerCase()}`;
}

export function buildPublicListingsWhere(query: ListPublicListingsQuery, now: Date): Prisma.ListingWhereInput {
  const q = query.q?.trim();
  return {
    status: "PUBLISHED",
    archivedAt: null,
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    ...(query.type ? { type: query.type } : {}),
    ...(query.minPrice !== undefined || query.maxPrice !== undefined
      ? {
          price: {
            ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
            ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}),
          },
        }
      : {}),
    asset: {
      archivedAt: null,
      status: { notIn: ["BOOKED", "CONTRACTED", "SOLD", "UNAVAILABLE"] },
      ...(query.category ? { category: query.category } : {}),
      ...(query.district ? { district: { contains: query.district, mode: "insensitive" } } : {}),
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.roomType ? { roomType: query.roomType } : {}),
      ...(query.bedrooms !== undefined ? { bedrooms: { gte: query.bedrooms } } : {}),
      ...(query.petAllowed !== undefined ? { petAllowed: query.petAllowed === "true" } : {}),
      ...(query.nearTransit === "true" ? { project: { nearTransit: { isEmpty: false } } } : {}),
      ...(query.minAreaSqm !== undefined || query.maxAreaSqm !== undefined
        ? {
            areaSqm: {
              ...(query.minAreaSqm !== undefined ? { gte: query.minAreaSqm } : {}),
              ...(query.maxAreaSqm !== undefined ? { lte: query.maxAreaSqm } : {}),
            },
          }
        : {}),
    },
    ...(q
      ? {
          AND: [
            {
              OR: [
                { titleTh: { contains: q, mode: "insensitive" } },
                { titleEn: { contains: q, mode: "insensitive" } },
                { asset: { district: { contains: q, mode: "insensitive" } } },
                { asset: { province: { contains: q, mode: "insensitive" } } },
                { asset: { project: { name: { contains: q, mode: "insensitive" } } } },
              ],
            },
          ],
        }
      : {}),
  };
}
