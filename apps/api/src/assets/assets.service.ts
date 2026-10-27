import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { type AssetCategory, type OwnershipType, Prisma, nextCode } from "@rrs/db";
import { parseAssetAttributes } from "@rrs/shared";
import type { AuthUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { DataScopeService } from "../rbac/data-scope.service";
import { type AssetWithRelations, redactAssetForUser } from "../rbac/field-redaction";
import {
  type ListAssetsParams,
  type UpsertAssetInput,
  assetDetailInclude,
  buildAssetUpdateData,
  toDec,
} from "./assets.types";

@Injectable()
export class AssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataScope: DataScopeService,
  ) {}

  private validateAttributes(category: AssetCategory, attributes: unknown): Prisma.InputJsonValue {
    try {
      return parseAssetAttributes(category, attributes) as Prisma.InputJsonValue;
    } catch (err) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: `ข้อมูลเฉพาะประเภท ${category} ไม่ถูกต้อง`,
        details: err instanceof Error && "issues" in err ? (err as { issues: unknown }).issues : undefined,
      });
    }
  }

  async list(user: AuthUser, params: ListAssetsParams) {
    const scopedWhere = this.dataScope.where(user, "assets", "asset.read") as Prisma.AssetWhereInput;
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
    const q = params.search?.trim();

    const where: Prisma.AssetWhereInput = {
      AND: [
        scopedWhere,
        ...(params.category ? [{ category: params.category }] : []),
        ...(params.status ? [{ status: params.status }] : []),
        ...(params.ownershipType ? [{ ownershipType: params.ownershipType }] : []),
        ...(params.projectId ? [{ projectId: params.projectId }] : []),
        ...(params.ownerId ? [{ ownerId: params.ownerId }] : []),
        ...(q
          ? [
              {
                OR: [
                  { code: { contains: q, mode: "insensitive" as const } },
                  { unitNo: { contains: q, mode: "insensitive" as const } },
                  { district: { contains: q, mode: "insensitive" as const } },
                  { project: { name: { contains: q, mode: "insensitive" as const } } },
                ],
              },
            ]
          : []),
      ],
    };

    const [total, rows] = await Promise.all([
      this.prisma.asset.count({ where }),
      this.prisma.asset.findMany({
        where,
        orderBy: { [params.sortBy ?? "createdAt"]: params.sortDir ?? "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: assetDetailInclude,
      }),
    ]);

    return {
      total,
      page,
      pageSize,
      items: rows.map((a) => redactAssetForUser(user, a as unknown as AssetWithRelations, { isList: true })),
    };
  }

  async getById(user: AuthUser, id: string) {
    const scopedWhere = this.dataScope.where(user, "assets", "asset.read") as Prisma.AssetWhereInput;
    const asset = await this.prisma.asset.findFirst({
      where: { AND: [{ id }, scopedWhere] },
      include: assetDetailInclude,
    });
    if (!asset) throw new NotFoundException({ code: "ASSET_NOT_FOUND", message: "ไม่พบข้อมูลทรัพย์สินนี้" });
    return redactAssetForUser(user, asset as unknown as AssetWithRelations);
  }

  private async resolveOwnerId(ownershipType: OwnershipType, ownerId?: string | null): Promise<string> {
    if (ownerId) return ownerId;
    if (ownershipType === "OWNER") {
      const company = await this.prisma.owner.findFirst({ where: { isCompany: true, archivedAt: null } });
      if (company) return company.id;
      const code = await nextCode(this.prisma, "OW", "OW-");
      const created = await this.prisma.owner.create({
        data: { code, fullName: "บริษัท RRS จำกัด", isCompany: true, status: "LISTED" },
      });
      return created.id;
    }
    throw new BadRequestException({
      code: "OWNER_REQUIRED",
      message: "กรุณาระบุเจ้าของทรัพย์สำหรับห้องรับฝาก (AGENT)",
    });
  }

  async create(user: AuthUser, input: UpsertAssetInput & { category: AssetCategory; ownershipType: OwnershipType }) {
    if (input.status && input.status !== "AVAILABLE" && input.status !== "UNAVAILABLE") {
      throw new BadRequestException({
        code: "INVALID_STATUS_TRANSITION",
        message: "สถานะห้องตั้งด้วยมือได้เฉพาะ ว่าง (AVAILABLE) หรือ ไม่ว่าง (UNAVAILABLE) เท่านั้น",
      });
    }
    const attributes = this.validateAttributes(input.category, input.attributes);
    const ownerId = await this.resolveOwnerId(input.ownershipType, input.ownerId);
    const code = await nextCode(this.prisma, "PR", "PR-");
    const primaryAgentId = input.primaryAgentId ?? user.id;

    return this.prisma.asset.create({
      data: {
        code,
        category: input.category,
        ownershipType: input.ownershipType,
        ownerId,
        projectId: input.projectId ?? null,
        buildingId: input.buildingId ?? null,
        tower: input.tower ?? null,
        unitNo: input.unitNo ?? null,
        floor: input.floor ?? null,
        address: input.address ?? null,
        district: input.district ?? null,
        province: input.province ?? null,
        areaSqm: toDec(input.areaSqm) ?? null,
        roomType: input.roomType ?? null,
        bedrooms: input.bedrooms ?? null,
        bathrooms: input.bathrooms ?? null,
        furniture: input.furniture ?? null,
        appliances: input.appliances ?? [],
        petAllowed: input.petAllowed ?? false,
        attributes,
        listingUrls: input.listingUrls ?? [],
        rentPrice: toDec(input.rentPrice) ?? null,
        minRentPrice: toDec(input.minRentPrice) ?? null,
        salePrice: toDec(input.salePrice) ?? null,
        minSalePrice: toDec(input.minSalePrice) ?? null,
        forRent: input.forRent ?? true,
        forSale: input.forSale ?? false,
        availableFrom: input.availableFrom ? new Date(input.availableFrom) : null,
        status: input.status ?? "AVAILABLE",
        primaryAgentId,
        internalNote: input.internalNote ?? null,
        createdById: user.id,
        updatedById: user.id,
        agents: primaryAgentId ? { create: [{ userId: primaryAgentId, role: "LISTING" }] } : undefined,
      },
      include: assetDetailInclude,
    });
  }

  async update(user: AuthUser, id: string, input: UpsertAssetInput) {
    const scopedWhere = this.dataScope.where(user, "assets", "asset.write") as Prisma.AssetWhereInput;
    const existing = await this.prisma.asset.findFirst({ where: { AND: [{ id }, scopedWhere] } });
    if (!existing) {
      throw new ForbiddenException({ code: "FORBIDDEN", message: "คุณไม่มีสิทธิ์แก้ไขข้อมูลทรัพย์สินรายการนี้" });
    }
    if (input.status !== undefined && input.status !== existing.status) {
      const allowed =
        input.status === "UNAVAILABLE" || (existing.status === "UNAVAILABLE" && input.status === "AVAILABLE");
      if (!allowed) {
        throw new BadRequestException({
          code: "INVALID_STATUS_TRANSITION",
          message: "สถานะห้องแก้มือได้เฉพาะ ไม่ว่าง (UNAVAILABLE) หรือเปิดกลับเป็นว่างเท่านั้น",
        });
      }
    }
    const targetCategory = input.category ?? existing.category;
    const attributes =
      input.attributes !== undefined || input.category !== undefined
        ? this.validateAttributes(targetCategory, input.attributes ?? existing.attributes)
        : undefined;

    return this.prisma.asset.update({
      where: { id },
      data: buildAssetUpdateData(user.id, input, attributes),
      include: assetDetailInclude,
    });
  }

  async archive(user: AuthUser, id: string) {
    const scopedWhere = this.dataScope.where(user, "assets", "asset.write") as Prisma.AssetWhereInput;
    const existing = await this.prisma.asset.findFirst({ where: { AND: [{ id }, scopedWhere] } });
    if (!existing) {
      throw new ForbiddenException({ code: "FORBIDDEN", message: "คุณไม่มีสิทธิ์เก็บทรัพย์สินรายการนี้เข้ากรุ" });
    }
    return this.prisma.asset.update({
      where: { id },
      data: { archivedAt: new Date(), archivedById: user.id, updatedById: user.id },
    });
  }
}
