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
import { type LeadWithRelations, redactLeadInList } from "./field-redaction";

const PatchLeadBody = z.object({
  fullName: z.string().trim().min(1).max(120).optional(),
  specialNote: z.string().max(1000).nullish(),
});

const leadInclude = {
  ownerAgent: { select: { id: true, fullName: true, teamId: true } },
  collaborators: { include: { user: { select: { teamId: true } } } },
} as const;

@ApiTags("rbac-scoped")
@ApiBearerAuth()
@Controller()
export class ScopedEntitiesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataScope: DataScopeService,
  ) {}

  @Get("agents")
  @ApiOperation({ summary: "รายชื่อผู้ใช้งานที่เปิดใช้งานอยู่สำหรับเลือกผู้รับผิดชอบ" })
  async listAgents() {
    const items = await this.prisma.user.findMany({
      where: { isActive: true, archivedAt: null },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, nickname: true, teamId: true },
    });
    return { items };
  }

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
}
