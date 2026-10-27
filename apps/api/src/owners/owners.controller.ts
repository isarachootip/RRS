import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import type { AuthUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/public.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { Can } from "../rbac/can.decorator";
import { OwnersService } from "./owners.service";

const OwnerStatusEnum = z.enum(["NEW", "CONTACTED", "LISTED", "INACTIVE"]);
const LeadSourceEnum = z.enum([
  "FACEBOOK",
  "WEBSITE",
  "LINE",
  "REFERRAL",
  "PHONE",
  "WALK_IN",
  "PROPERTY_PORTAL",
  "OTHER",
]);

const ListQuerySchema = z.object({
  search: z.string().optional(),
  status: OwnerStatusEnum.optional(),
  agentId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  sortBy: z.enum(["createdAt", "code", "fullName"]).optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
});

const DuplicateQuerySchema = z.object({
  phone: z.string().optional(),
  lineId: z.string().optional(),
  email: z.string().optional(),
  excludeId: z.string().uuid().optional(),
});

const CreateOwnerSchema = z.object({
  fullName: z.string().trim().min(1).max(150),
  isCompany: z.boolean().optional(),
  phone: z.string().max(40).nullish(),
  lineId: z.string().max(80).nullish(),
  email: z.string().email().max(150).nullish().or(z.literal("")),
  sourceChannel: LeadSourceEnum.nullish(),
  firstContactAt: z.string().nullish(),
  agentId: z.string().uuid().nullish(),
  status: OwnerStatusEnum.optional(),
  note: z.string().max(2000).nullish(),
});

const UpdateOwnerSchema = CreateOwnerSchema.partial();

@ApiTags("owners")
@ApiBearerAuth()
@Controller("owners")
export class OwnersController {
  constructor(private readonly owners: OwnersService) {}

  @Can("owner.read")
  @Get("duplicates")
  @ApiOperation({ summary: "ตรวจเบอร์โทร/LINE/อีเมลเจ้าของทรัพย์ซ้ำก่อนบันทึก (แจ้งเตือน ไม่บล็อก)" })
  checkDuplicates(@Query(new ZodPipe(DuplicateQuerySchema)) query: z.infer<typeof DuplicateQuerySchema>) {
    return this.owners.checkDuplicates(query);
  }

  @Can("owner.read")
  @Get()
  @ApiOperation({ summary: "รายการเจ้าของทรัพย์ (ค้นหา กรอง เรียง แบ่งหน้า เคารพ data scope)" })
  list(@CurrentUser() user: AuthUser, @Query(new ZodPipe(ListQuerySchema)) query: z.infer<typeof ListQuerySchema>) {
    return this.owners.list(user, query);
  }

  @Can("owner.read")
  @Get(":id")
  @ApiOperation({ summary: "ดูรายละเอียดเจ้าของทรัพย์พร้อมรายการทรัพย์สินที่ผูกอยู่" })
  getById(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.owners.getById(user, id);
  }

  @Can("owner.write")
  @Post()
  @ApiOperation({ summary: "เพิ่มเจ้าของทรัพย์ใหม่ (ออกรหัส OW-xxxxxx อัตโนมัติ)" })
  create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(CreateOwnerSchema)) body: z.infer<typeof CreateOwnerSchema>) {
    return this.owners.create(user, { ...body, email: body.email || null });
  }

  @Can("owner.write")
  @Patch(":id")
  @ApiOperation({ summary: "แก้ไขข้อมูลเจ้าของทรัพย์" })
  update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodPipe(UpdateOwnerSchema)) body: z.infer<typeof UpdateOwnerSchema>,
  ) {
    return this.owners.update(user, id, {
      ...body,
      ...(body.email !== undefined ? { email: body.email || null } : {}),
    });
  }

  @Can("owner.write")
  @Post(":id/archive")
  @HttpCode(200)
  @ApiOperation({ summary: "เก็บเจ้าของทรัพย์เข้ากรุ (Archive)" })
  archive(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.owners.archive(user, id);
  }
}
