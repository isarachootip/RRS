import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@rrs/db";
import { AuditService } from "../audit/audit.service";
import type { AuthUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { DataScopeService } from "../rbac/data-scope.service";
import { BACKOFFICE_LISTING_INCLUDE, slugifyListing } from "./listings-where.helper";
import type { CreateListingInput, ListBackofficeListingsQuery, UpdateListingInput } from "./listings.types";

@Injectable()
export class ListingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataScope: DataScopeService,
    private readonly audit: AuditService,
  ) {}

  private async ensureUniqueSlug(baseSlug: string, excludeId?: string): Promise<string> {
    let candidate = baseSlug;
    let counter = 1;
    while (true) {
      const existing = await this.prisma.listing.findUnique({ where: { slug: candidate }, select: { id: true } });
      if (!existing || existing.id === excludeId) return candidate;
      counter += 1;
      candidate = `${baseSlug}-${counter}`;
    }
  }

  async listBackoffice(user: AuthUser, query: ListBackofficeListingsQuery) {
    const assetScope = this.dataScope.where(user, "assets", "asset.read") as Prisma.AssetWhereInput;
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const q = query.search?.trim();
    const isArchived = query.archived === "true";
    const where: Prisma.ListingWhereInput = {
      archivedAt: isArchived ? { not: null } : null,
      asset: assetScope,
      ...(query.status ? { status: query.status } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.assetId ? { assetId: query.assetId } : {}),
      ...(q
        ? {
            OR: [
              { titleTh: { contains: q, mode: "insensitive" } },
              { titleEn: { contains: q, mode: "insensitive" } },
              { slug: { contains: q, mode: "insensitive" } },
              { asset: { code: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    };
    const [total, items] = await Promise.all([
      this.prisma.listing.count({ where }),
      this.prisma.listing.findMany({
        where,
        include: BACKOFFICE_LISTING_INCLUDE,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { total, page, pageSize, items };
  }

  async getById(user: AuthUser, id: string) {
    const assetScope = this.dataScope.where(user, "assets", "asset.read") as Prisma.AssetWhereInput;
    const row = await this.prisma.listing.findFirst({
      where: { id, archivedAt: null, asset: assetScope },
      include: BACKOFFICE_LISTING_INCLUDE,
    });
    if (!row) throw new NotFoundException({ code: "LISTING_NOT_FOUND", message: "ไม่พบประกาศนี้" });
    return row;
  }

  async create(user: AuthUser, input: CreateListingInput) {
    const assetWriteScope = this.dataScope.where(user, "assets", "listing.write") as Prisma.AssetWhereInput;
    const asset = await this.prisma.asset.findFirst({
      where: { AND: [{ id: input.assetId }, assetWriteScope] },
      select: { id: true, code: true, status: true },
    });
    if (!asset) {
      throw new ForbiddenException({ code: "FORBIDDEN", message: "คุณไม่มีสิทธิ์สร้างประกาศสำหรับทรัพย์สินนี้" });
    }
    const baseSlug = slugifyListing(input.slug, input.titleEn || input.titleTh, asset.code, input.type);
    const slug = await this.ensureUniqueSlug(baseSlug);
    return this.prisma.listing.create({
      data: {
        assetId: asset.id,
        type: input.type,
        status: input.submitForApproval ? "PENDING_APPROVAL" : "DRAFT",
        slug,
        titleTh: input.titleTh,
        titleEn: input.titleEn ?? null,
        descriptionTh: input.descriptionTh ?? null,
        descriptionEn: input.descriptionEn ?? null,
        price: new Prisma.Decimal(input.price.toFixed(2)),
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        createdById: user.id,
      },
      include: BACKOFFICE_LISTING_INCLUDE,
    });
  }

  async update(user: AuthUser, id: string, input: UpdateListingInput) {
    const existing = await this.getById(user, id);
    let slug = existing.slug;
    if (input.slug && input.slug !== existing.slug) {
      const baseSlug = slugifyListing(
        input.slug,
        input.titleTh ?? existing.titleTh,
        existing.asset.code,
        existing.type,
      );
      slug = await this.ensureUniqueSlug(baseSlug, id);
    }
    return this.prisma.listing.update({
      where: { id },
      data: {
        ...(input.titleTh !== undefined ? { titleTh: input.titleTh } : {}),
        ...(input.titleEn !== undefined ? { titleEn: input.titleEn } : {}),
        ...(input.descriptionTh !== undefined ? { descriptionTh: input.descriptionTh } : {}),
        ...(input.descriptionEn !== undefined ? { descriptionEn: input.descriptionEn } : {}),
        ...(input.price !== undefined ? { price: new Prisma.Decimal(input.price.toFixed(2)) } : {}),
        ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt ? new Date(input.expiresAt) : null } : {}),
        slug,
      },
      include: BACKOFFICE_LISTING_INCLUDE,
    });
  }

  async submitForApproval(user: AuthUser, id: string) {
    const existing = await this.getById(user, id);
    return this.prisma.listing.update({
      where: { id: existing.id },
      data: { status: "PENDING_APPROVAL", approvedById: null, approvedAt: null },
      include: BACKOFFICE_LISTING_INCLUDE,
    });
  }

  async approve(user: AuthUser, id: string) {
    const existing = await this.getById(user, id);
    if (["BOOKED", "CONTRACTED", "SOLD", "UNAVAILABLE"].includes(existing.asset.status)) {
      throw new BadRequestException({
        code: "ASSET_NOT_AVAILABLE",
        message: "ไม่สามารถเผยแพร่ประกาศได้เนื่องจากทรัพย์สินไม่อยู่ในสถานะว่าง",
      });
    }
    const now = new Date();
    const updated = await this.prisma.listing.update({
      where: { id: existing.id },
      data: {
        status: "PUBLISHED",
        approvedById: user.id,
        approvedAt: now,
        publishedAt: existing.publishedAt ?? now,
      },
      include: BACKOFFICE_LISTING_INCLUDE,
    });
    await this.audit.log({
      action: "APPROVE",
      entityType: "Listing",
      entityId: existing.id,
      actorId: user.id,
      before: { status: existing.status },
      after: { status: "PUBLISHED", approvedAt: now.toISOString() },
    });
    return updated;
  }

  async close(user: AuthUser, id: string) {
    const existing = await this.getById(user, id);
    return this.prisma.listing.update({
      where: { id: existing.id },
      data: { status: "CLOSED" },
      include: BACKOFFICE_LISTING_INCLUDE,
    });
  }

  async archive(user: AuthUser, id: string) {
    const existing = await this.getById(user, id);
    return this.prisma.listing.update({
      where: { id: existing.id },
      data: { status: "CLOSED", archivedAt: new Date() },
    });
  }

  async expireListingsJob(asOfDate?: string) {
    const now = asOfDate ? new Date(asOfDate) : new Date();
    const expired = await this.prisma.listing.findMany({
      where: { archivedAt: null, status: { in: ["PUBLISHED", "PENDING_APPROVAL"] }, expiresAt: { lte: now } },
      select: { id: true },
    });
    if (expired.length > 0) {
      await this.prisma.listing.updateMany({
        where: { id: { in: expired.map((r) => r.id) } },
        data: { status: "CLOSED" },
      });
    }
    return { expiredCount: expired.length, listingIds: expired.map((r) => r.id) };
  }
}
