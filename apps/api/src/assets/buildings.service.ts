import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { type OwnershipType, Prisma, type RoomType, nextCode } from "@rrs/db";
import { parseAssetAttributes } from "@rrs/shared";
import type { AuthUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";

export interface CreateBuildingInput {
  name: string;
  ownerId: string;
  projectId?: string | null;
  address?: string | null;
  totalFloors?: number | null;
}

export interface BulkUnitItem {
  unitNo: string;
  floor?: number | null;
  areaSqm?: number | null;
  roomType?: RoomType | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  rentPrice?: number | null;
  minRentPrice?: number | null;
  attributes?: unknown;
}

export interface BulkCreateUnitsInput {
  ownershipType?: OwnershipType;
  primaryAgentId?: string | null;
  units: BulkUnitItem[];
}

@Injectable()
export class BuildingsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const items = await this.prisma.building.findMany({
      where: { archivedAt: null },
      orderBy: { createdAt: "desc" },
      include: {
        owner: { select: { id: true, code: true, fullName: true } },
        _count: { select: { units: { where: { archivedAt: null } } } },
      },
    });
    return { items };
  }

  create(input: CreateBuildingInput) {
    return this.prisma.building.create({
      data: {
        name: input.name,
        ownerId: input.ownerId,
        projectId: input.projectId ?? null,
        address: input.address ?? null,
        totalFloors: input.totalFloors ?? null,
      },
    });
  }

  async bulkCreateUnits(user: AuthUser, buildingId: string, input: BulkCreateUnitsInput) {
    const building = await this.prisma.building.findFirst({
      where: { id: buildingId, archivedAt: null },
    });
    if (!building) {
      throw new NotFoundException({ code: "BUILDING_NOT_FOUND", message: "ไม่พบข้อมูลอาคารอพาร์ตเมนต์นี้" });
    }

    const parsedUnits = input.units.map((u) => {
      try {
        return {
          ...u,
          attributes: parseAssetAttributes("APARTMENT_UNIT", u.attributes ?? {}),
        };
      } catch (err) {
        throw new BadRequestException({
          code: "VALIDATION_ERROR",
          message: `ข้อมูลเฉพาะห้อง ${u.unitNo} ไม่ถูกต้องตามประเภท APARTMENT_UNIT`,
          details: err instanceof Error && "issues" in err ? (err as { issues: unknown }).issues : undefined,
        });
      }
    });

    const primaryAgentId = input.primaryAgentId ?? user.id;
    const created = [];

    for (const u of parsedUnits) {
      const code = await nextCode(this.prisma, "PR", "PR-");
      const asset = await this.prisma.asset.create({
        data: {
          code,
          category: "APARTMENT_UNIT",
          ownershipType: input.ownershipType ?? "AGENT",
          ownerId: building.ownerId,
          projectId: building.projectId,
          buildingId: building.id,
          unitNo: u.unitNo,
          floor: u.floor ?? null,
          address: building.address,
          areaSqm: u.areaSqm !== undefined && u.areaSqm !== null ? new Prisma.Decimal(u.areaSqm.toFixed(2)) : null,
          roomType: u.roomType ?? "STUDIO",
          bedrooms: u.bedrooms ?? 1,
          bathrooms: u.bathrooms ?? 1,
          rentPrice:
            u.rentPrice !== undefined && u.rentPrice !== null ? new Prisma.Decimal(u.rentPrice.toFixed(2)) : null,
          minRentPrice:
            u.minRentPrice !== undefined && u.minRentPrice !== null
              ? new Prisma.Decimal(u.minRentPrice.toFixed(2))
              : null,
          forRent: true,
          forSale: false,
          primaryAgentId,
          attributes: u.attributes as Prisma.InputJsonValue,
          createdById: user.id,
          updatedById: user.id,
          agents: primaryAgentId ? { create: [{ userId: primaryAgentId, role: "LISTING" }] } : undefined,
        },
      });
      created.push(asset);
    }

    return { createdCount: created.length, items: created };
  }
}
