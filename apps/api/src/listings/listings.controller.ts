import { Body, Controller, Get, HttpCode, Param, Patch, Post, Put, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import type { AuthUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/public.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { Can } from "../rbac/can.decorator";
import { ListingsService } from "./listings.service";
import { PublicListingsService } from "./public-listings.service";
import {
  type CreateListingInput,
  type ListBackofficeListingsQuery,
  type UpdateListingInput,
  createListingSchema,
  listBackofficeListingsSchema,
  updateListingSchema,
} from "./listings.types";

const expireJobSchema = z.object({
  asOfDate: z.string().datetime().optional(),
});

const contactConfigSchema = z.object({
  lineOaId: z.string().min(1).max(60),
  phone: z.string().min(3).max(40),
  companyName: z.string().min(1).max(120).optional().default("RRS Real Estate"),
  lineAdminUserId: z.string().max(80).optional(),
});

@ApiTags("listings")
@ApiBearerAuth()
@Controller("listings")
export class ListingsController {
  constructor(
    private readonly listings: ListingsService,
    private readonly publicListings: PublicListingsService,
  ) {}

  @Put("contact-config")
  @Can("listing.write")
  @ApiOperation({ summary: "บันทึกการตั้งค่าช่องทางติดต่อหลักหน้าเว็บ Portal (LINE OA องค์กร & เบอร์โทร)" })
  updateContactConfig(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(contactConfigSchema)) body: z.infer<typeof contactConfigSchema>,
  ) {
    return this.publicListings.updateContactConfig(body, user.id);
  }

  @Post("contact-config/test-line")
  @HttpCode(200)
  @Can("listing.write")
  @ApiOperation({ summary: "ทดสอบส่งข้อความแจ้งเตือนเข้า LINE ของแอดมินผ่าน LINE Messaging API" })
  testLinePush() {
    return this.publicListings.sendTestLineToAdmin();
  }

  @Get()
  @Can("asset.read")
  @ApiOperation({ summary: "รายการประกาศทั้งหมดในระบบหลังบ้านตามสิทธิ์" })
  list(
    @CurrentUser() user: AuthUser,
    @Query(new ZodPipe(listBackofficeListingsSchema)) query: ListBackofficeListingsQuery,
  ) {
    return this.listings.listBackoffice(user, query);
  }

  @Get(":id")
  @Can("asset.read")
  @ApiOperation({ summary: "ดูรายละเอียดประกาศในระบบหลังบ้าน" })
  getById(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.listings.getById(user, id);
  }

  @Post()
  @Can("listing.write")
  @ApiOperation({ summary: "สร้างประกาศใหม่ (DRAFT หรือส่งขออนุมัติ PENDING_APPROVAL)" })
  create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(createListingSchema)) body: CreateListingInput) {
    return this.listings.create(user, body);
  }

  @Patch(":id")
  @Can("listing.write")
  @ApiOperation({ summary: "แก้ไขข้อมูลประกาศ" })
  update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodPipe(updateListingSchema)) body: UpdateListingInput,
  ) {
    return this.listings.update(user, id, body);
  }

  @Post(":id/submit")
  @HttpCode(200)
  @Can("listing.write")
  @ApiOperation({ summary: "ส่งประกาศให้ Manager อนุมัติ (PENDING_APPROVAL)" })
  submitForApproval(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.listings.submitForApproval(user, id);
  }

  @Post(":id/approve")
  @HttpCode(200)
  @Can("listing.approve")
  @ApiOperation({ summary: "Manager อนุมัติเผยแพร่ประกาศขึ้นเว็บ (PUBLISHED)" })
  approve(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.listings.approve(user, id);
  }

  @Post(":id/close")
  @HttpCode(200)
  @Can("listing.write")
  @ApiOperation({ summary: "ปิดประกาศ (CLOSED)" })
  close(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.listings.close(user, id);
  }

  @Post(":id/archive")
  @HttpCode(200)
  @Can("listing.write")
  @ApiOperation({ summary: "เก็บประกาศเข้ากรุ (Archive)" })
  archive(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.listings.archive(user, id);
  }

  @Post("jobs/expire")
  @HttpCode(200)
  @Can("listing.approve")
  @ApiOperation({ summary: "Job รายวันปิดประกาศที่หมดอายุ (expires_at <= วันนี้)" })
  expireJob(@Body(new ZodPipe(expireJobSchema)) body: z.infer<typeof expireJobSchema>) {
    return this.listings.expireListingsJob(body.asOfDate);
  }
}
