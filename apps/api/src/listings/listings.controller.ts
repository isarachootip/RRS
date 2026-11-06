import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import type { AuthUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/public.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { Can } from "../rbac/can.decorator";
import { ListingsService } from "./listings.service";
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

@ApiTags("listings")
@ApiBearerAuth()
@Controller("listings")
export class ListingsController {
  constructor(private readonly listings: ListingsService) {}

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
