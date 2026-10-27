import { Body, Controller, ForbiddenException, Get, NotFoundException, Param, Patch, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Prisma } from "@rrs/db";
import { z } from "zod";
import type { AuthUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/public.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { PrismaService } from "../prisma/prisma.service";
import { Can } from "./can.decorator";
import { DataScopeService } from "./data-scope.service";
import {
  type AssetWithRelations,
  type LeadWithRelations,
  redactAssetForUser,
  redactLeadInList,
} from "./field-redaction";

const PatchLeadBody = z.object({
  fullName: z.string().trim().min(1).max(120).optional(),
  specialNote: z.string().max(1000).nullish(),
});

const PatchAssetBody = z.object({
  internalNote: z.string().max(1000).nullish(),
});

const leadInclude = {
  ownerAgent: { select: { id: true, fullName: true, teamId: true } },
  collaborators: { include: { user: { select: { teamId: true } } } },
} as const;

const assetInclude = {
  owner: { include: { agent: { select: { teamId: true } } } },
  primaryAgent: { select: { id: true, fullName: true, teamId: true } },
  agents: { include: { user: { select: { teamId: true } } } },
} as const;

@ApiTags("rbac-scoped")
@ApiBearerAuth()
@Controller()
export class ScopedEntitiesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataScope: DataScopeService,
  ) {}

  @Can("lead.read")
  @Get("leads")
  @ApiOperation({ summary: "รายการลูกค้าตาม data scope (หรือรวมชื่อย่อของคนอื่นเมื่อ includeDirectory=true)" })
  async listLeads(@CurrentUser() user: AuthUser, @Query("includeDirectory") includeDirectory?: string) {
    const where: Prisma.LeadWhereInput =
      includeDirectory === "true"
        ? { archivedAt: null }
        : (this.dataScope.where(user, "leads", "lead.read") as Prisma.LeadWhereInput);
    const leads = await this.prisma.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: leadInclude,
    });
    return {
      items: leads.map((l) => redactLeadInList(user, l as unknown as LeadWithRelations)),
    };
  }

  @Can("lead.read")
  @Get("leads/:id")
  @ApiOperation({ summary: "ดูรายละเอียดลูกค้า (ตรวจ data scope)" })
  async getLead(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    const exists = await this.prisma.lead.findFirst({ where: { id, archivedAt: null } });
    if (!exists) throw new NotFoundException({ code: "LEAD_NOT_FOUND", message: "ไม่พบข้อมูลลูกค้านี้" });

    const scopedWhere = this.dataScope.where(user, "leads", "lead.read") as Prisma.LeadWhereInput;
    const lead = await this.prisma.lead.findFirst({
      where: { AND: [{ id }, scopedWhere] },
      include: leadInclude,
    });
    if (!lead) {
      throw new ForbiddenException({ code: "FORBIDDEN", message: "คุณไม่มีสิทธิ์ดูข้อมูลลูกค้ารายนี้" });
    }
    return lead;
  }

  @Can("lead.write")
  @Patch("leads/:id")
  @ApiOperation({ summary: "แก้ไขข้อมูลลูกค้า (ตรวจ data scope ของ lead.write และบันทึก audit อัตโนมัติ)" })
  async updateLead(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodPipe(PatchLeadBody)) body: z.infer<typeof PatchLeadBody>,
  ) {
    const scopedWhere = this.dataScope.where(user, "leads", "lead.write") as Prisma.LeadWhereInput;
    const before = await this.prisma.lead.findFirst({ where: { AND: [{ id }, scopedWhere] } });
    if (!before) {
      throw new ForbiddenException({ code: "FORBIDDEN", message: "คุณไม่มีสิทธิ์แก้ไขข้อมูลลูกค้ารายนี้" });
    }
    return this.prisma.lead.update({
      where: { id },
      data: {
        ...(body.fullName !== undefined ? { fullName: body.fullName } : {}),
        ...(body.specialNote !== undefined ? { specialNote: body.specialNote } : {}),
        updatedById: user.id,
      },
    });
  }

  @Can("asset.read")
  @Get("assets")
  @ApiOperation({ summary: "รายการทรัพย์สินพร้อมซ่อน minPrice และข้อมูลติดต่อเจ้าของตามสิทธิ์" })
  async listAssets(@CurrentUser() user: AuthUser) {
    const scopedWhere = this.dataScope.where(user, "assets", "asset.read") as Prisma.AssetWhereInput;
    const assets = await this.prisma.asset.findMany({
      where: scopedWhere,
      orderBy: { createdAt: "desc" },
      include: assetInclude,
    });
    return {
      items: assets.map((a) => redactAssetForUser(user, a as unknown as AssetWithRelations, { isList: true })),
    };
  }

  @Can("asset.read")
  @Get("assets/:id")
  @ApiOperation({ summary: "ดูรายละเอียดทรัพย์สินพร้อมซ่อน minPrice และข้อมูลติดต่อเจ้าของตามสิทธิ์" })
  async getAsset(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    const scopedWhere = this.dataScope.where(user, "assets", "asset.read") as Prisma.AssetWhereInput;
    const asset = await this.prisma.asset.findFirst({
      where: { AND: [{ id }, scopedWhere] },
      include: assetInclude,
    });
    if (!asset) {
      throw new NotFoundException({ code: "ASSET_NOT_FOUND", message: "ไม่พบข้อมูลทรัพย์สินนี้" });
    }
    return redactAssetForUser(user, asset as unknown as AssetWithRelations);
  }

  @Can("asset.write")
  @Patch("assets/:id")
  @ApiOperation({ summary: "แก้ไขข้อมูลทรัพย์สิน (ตรวจ data scope ตาม D15 และบันทึก audit อัตโนมัติ)" })
  async updateAsset(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodPipe(PatchAssetBody)) body: z.infer<typeof PatchAssetBody>,
  ) {
    const scopedWhere = this.dataScope.where(user, "assets", "asset.write") as Prisma.AssetWhereInput;
    const before = await this.prisma.asset.findFirst({ where: { AND: [{ id }, scopedWhere] } });
    if (!before) {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "คุณไม่มีสิทธิ์แก้ไขข้อมูลทรัพย์สินรายการนี้",
      });
    }
    return this.prisma.asset.update({
      where: { id },
      data: {
        ...(body.internalNote !== undefined ? { internalNote: body.internalNote } : {}),
        updatedById: user.id,
      },
    });
  }
}
