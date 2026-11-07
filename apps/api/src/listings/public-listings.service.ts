import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@rrs/db";
import { PrismaService } from "../prisma/prisma.service";
import { PUBLIC_LISTING_SELECT, toPublicListingDto } from "./listings-public.helper";
import { buildPublicListingsWhere } from "./listings-where.helper";
import type { ListPublicListingsQuery } from "./listings.types";

@Injectable()
export class PublicListingsService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublic(query: ListPublicListingsQuery) {
    const now = new Date();
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(50, Math.max(1, query.pageSize ?? 12));
    const where = buildPublicListingsWhere(query, now);
    const orderBy: Prisma.ListingOrderByWithRelationInput =
      query.sort === "price_asc"
        ? { price: "asc" }
        : query.sort === "price_desc"
          ? { price: "desc" }
          : query.sort === "popular"
            ? { viewCount: "desc" }
            : { publishedAt: "desc" };
    const [total, rows] = await Promise.all([
      this.prisma.listing.count({ where }),
      this.prisma.listing.findMany({
        where,
        select: PUBLIC_LISTING_SELECT,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { total, page, pageSize, items: rows.map(toPublicListingDto) };
  }

  async getPublicBySlug(rawSlug: string) {
    let decodedSlug = rawSlug.trim();
    try {
      for (let i = 0; i < 3; i += 1) {
        const next = decodeURIComponent(decodedSlug);
        if (next === decodedSlug) break;
        decodedSlug = next;
      }
    } catch {
      // Keep current decodedSlug if malformed % sequence
    }

    const codeSuffixMatch = decodedSlug.match(/(pr-\d{3,10})-(rent|sale)(?:-\d+)?$/i);
    const slugOrCodeMatch: Prisma.ListingWhereInput[] = [
      { slug: { equals: decodedSlug, mode: "insensitive" } },
      { slug: { equals: rawSlug.trim(), mode: "insensitive" } },
    ];
    if (codeSuffixMatch?.[1] && codeSuffixMatch?.[2]) {
      slugOrCodeMatch.push({
        type: codeSuffixMatch[2].toUpperCase() as "RENT" | "SALE",
        asset: { code: { equals: codeSuffixMatch[1].toUpperCase(), mode: "insensitive" } },
      });
    }

    const now = new Date();
    const row = await this.prisma.listing.findFirst({
      where: {
        status: "PUBLISHED",
        archivedAt: null,
        AND: [
          { OR: slugOrCodeMatch },
          { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        ],
        asset: { archivedAt: null, status: { notIn: ["BOOKED", "CONTRACTED", "SOLD", "UNAVAILABLE"] } },
      },
      select: PUBLIC_LISTING_SELECT,
    });
    if (!row) throw new NotFoundException({ code: "LISTING_NOT_FOUND", message: "ไม่พบประกาศนี้" });
    await this.prisma.listing.update({ where: { id: row.id }, data: { viewCount: { increment: 1 } } });
    const nearbyRows = await this.prisma.listing.findMany({
      where: {
        id: { not: row.id },
        type: row.type,
        status: "PUBLISHED",
        archivedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        asset: {
          archivedAt: null,
          status: { notIn: ["BOOKED", "CONTRACTED", "SOLD", "UNAVAILABLE"] },
          category: row.asset.category,
        },
      },
      select: PUBLIC_LISTING_SELECT,
      orderBy: { publishedAt: "desc" },
      take: 4,
    });
    return {
      listing: toPublicListingDto({ ...row, viewCount: row.viewCount + 1 }),
      nearby: nearbyRows.map(toPublicListingDto),
    };
  }
}
