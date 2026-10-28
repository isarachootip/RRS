import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ASSET_CATEGORIES } from "@rrs/shared";
import { z } from "zod";
import type { AuthUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/public.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { Can } from "../rbac/can.decorator";
import { LeadsService } from "./leads.service";

const LeadIntentEnum = z.enum(["RENT", "BUY"]);
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
const LeadStatusEnum = z.enum([
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "VIEWING",
  "NEGOTIATING",
  "BOOKED",
  "CONTRACTED",
  "CLOSED_WON",
  "LOST",
  "CANCELLED",
  "UNDECIDED",
]);
const RoomTypeEnum = z.enum([
  "STUDIO",
  "ONE_BEDROOM",
  "TWO_BEDROOMS",
  "THREE_BEDROOMS",
  "PENTHOUSE",
  "DUPLEX",
  "OTHER",
]);

const ListLeadsQuerySchema = z.object({
  search: z.string().optional(),
  status: LeadStatusEnum.optional(),
  intent: LeadIntentEnum.optional(),
  ownerAgentId: z.string().uuid().optional(),
  includeDirectory: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  sortBy: z.enum(["createdAt", "code", "fullName", "nextFollowUpAt"]).optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
});

const DuplicateQuerySchema = z.object({
  phone: z.string().optional(),
  line: z.string().optional(),
  email: z.string().optional(),
  excludeId: z.string().uuid().optional(),
});

const CreateLeadSchema = z.object({
  intent: LeadIntentEnum.optional(),
  fullName: z.string().trim().min(1).max(150),
  phone: z.string().max(40).nullish(),
  lineId: z.string().max(80).nullish(),
  email: z.string().email().max(150).nullish().or(z.literal("")),
  nationality: z.string().max(80).nullish(),
  budgetMin: z.number().nonnegative().nullish(),
  budgetMax: z.number().nonnegative().nullish(),
  preferredLocation: z.string().max(200).nullish(),
  preferredProjectId: z.string().uuid().nullish(),
  preferredCategory: z.enum(ASSET_CATEGORIES).nullish(),
  preferredRoomType: RoomTypeEnum.nullish(),
  minAreaSqm: z.number().positive().nullish(),
  occupants: z.number().int().positive().nullish(),
  moveInDate: z.string().nullish(),
  leaseMonths: z.number().int().positive().nullish(),
  petRequired: z.boolean().optional(),
  specialNote: z.string().max(2000).nullish(),
  source: LeadSourceEnum,
  nextFollowUpAt: z.string().nullish(),
});

const UpdateLeadSchema = CreateLeadSchema.partial();

const UpdateStatusSchema = z.object({
  status: LeadStatusEnum,
  reason: z.string().max(500).nullish(),
});

@ApiTags("leads")
@ApiBearerAuth()
@Controller("leads")
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Can("lead.read")
  @Get("duplicates")
  @ApiOperation({ summary: "ตรวจเบอร์โทร/LINE/อีเมลลูกค้าซ้ำก่อนบันทึก โดยไม่เปิดข้อมูลติดต่อ" })
  checkDuplicates(
    @CurrentUser() user: AuthUser,
    @Query(new ZodPipe(DuplicateQuerySchema)) query: z.infer<typeof DuplicateQuerySchema>,
  ) {
    return this.leads.checkDuplicates(user, query);
  }

  @Can("lead.read")
  @Get()
  @ApiOperation({ summary: "รายการลูกค้าตาม data scope (หรือรวมชื่อย่อของคนอื่นเมื่อ includeDirectory=true)" })
  list(
    @CurrentUser() user: AuthUser,
    @Query(new ZodPipe(ListLeadsQuerySchema)) query: z.infer<typeof ListLeadsQuerySchema>,
  ) {
    return this.leads.list(user, query);
  }

  @Can("lead.read")
  @Get(":id")
  @ApiOperation({ summary: "ดูรายละเอียดลูกค้าพร้อมประวัติการโอน ผู้ร่วมงาน และกิจกรรม" })
  getById(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.leads.getById(user, id);
  }

  @Can("lead.write")
  @Post()
  @ApiOperation({ summary: "สร้างลูกค้าใหม่ (ผู้สร้างเป็นเจ้าของหลัก LD-xxxxxx)" })
  create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(CreateLeadSchema)) body: z.infer<typeof CreateLeadSchema>) {
    return this.leads.create(user, { ...body, email: body.email || null });
  }

  @Can("lead.write")
  @Patch(":id")
  @ApiOperation({ summary: "แก้ไขข้อมูลลูกค้า" })
  update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodPipe(UpdateLeadSchema)) body: z.infer<typeof UpdateLeadSchema>,
  ) {
    return this.leads.update(user, id, {
      ...body,
      ...(body.email !== undefined ? { email: body.email || null } : {}),
    });
  }

  @Can("lead.write")
  @Patch(":id/status")
  @ApiOperation({ summary: "เปลี่ยนสถานะลูกค้า (บังคับระบุเหตุผลเมื่อย้อนสถานะหรือเป็น LOST/CANCELLED/UNDECIDED)" })
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodPipe(UpdateStatusSchema)) body: z.infer<typeof UpdateStatusSchema>,
  ) {
    return this.leads.updateStatus(user, id, body.status, body.reason);
  }

  @Can("lead.write")
  @Post(":id/archive")
  @HttpCode(200)
  @ApiOperation({ summary: "เก็บลูกค้าเข้ากรุ (Archive)" })
  archive(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.leads.archive(user, id);
  }
}
