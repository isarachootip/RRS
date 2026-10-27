import { Body, Controller, Delete, Get, Param, Post, Put } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import type { AuthUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/public.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { Can } from "../rbac/can.decorator";
import { AssetRelationsService } from "./asset-relations.service";

const SetAgentsSchema = z.object({
  agents: z
    .array(
      z.object({
        userId: z.string().uuid(),
        role: z.enum(["LISTING", "CO_AGENT"]),
      }),
    )
    .max(20),
});

const AddMediaSchema = z.object({
  fileId: z.string().uuid(),
  caption: z.string().max(200).nullish(),
  isCover: z.boolean().optional(),
});

const ReorderMediaSchema = z.object({
  orderedIds: z.array(z.string().uuid()).max(100),
  coverMediaId: z.string().uuid().optional(),
});

const CreateAgreementSchema = z.object({
  transactionType: z.enum(["RENT", "SALE"]),
  startDate: z.string().min(8),
  endDate: z.string().nullish(),
  commissionFormula: z.enum(["ONE_MONTH", "PERCENT_TOTAL", "N_MONTHS", "FIXED", "CUSTOM", "PERCENT_SALE_PRICE"]),
  commissionParams: z.record(z.unknown()).optional(),
  exclusive: z.boolean().optional(),
  status: z.enum(["ACTIVE", "EXPIRED", "TERMINATED"]).optional(),
  fileId: z.string().uuid().nullish(),
  note: z.string().max(1000).nullish(),
});

@ApiTags("assets")
@ApiBearerAuth()
@Controller("assets/:id")
export class AssetRelationsController {
  constructor(private readonly relations: AssetRelationsService) {}

  @Can("asset.write")
  @Put("agents")
  @ApiOperation({ summary: "กำหนด Agent ผู้รับผิดชอบหลายคนต่อสินทรัพย์พร้อมบทบาท (LISTING / CO_AGENT)" })
  setAgents(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodPipe(SetAgentsSchema)) body: z.infer<typeof SetAgentsSchema>,
  ) {
    return this.relations.setAgents(user, id, body.agents);
  }

  @Can("asset.write")
  @Post("media")
  @ApiOperation({ summary: "ผูกไฟล์รูปเข้ากับแกลเลอรีของทรัพย์สิน" })
  addMedia(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodPipe(AddMediaSchema)) body: z.infer<typeof AddMediaSchema>,
  ) {
    return this.relations.addMedia(user, id, body);
  }

  @Can("asset.write")
  @Put("media/reorder")
  @ApiOperation({ summary: "จัดเรียงลำดับรูปภาพในแกลเลอรีและตั้งรูปปก" })
  reorderMedia(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodPipe(ReorderMediaSchema)) body: z.infer<typeof ReorderMediaSchema>,
  ) {
    return this.relations.reorderMedia(user, id, body);
  }

  @Can("asset.write")
  @Delete("media/:mediaId")
  @ApiOperation({ summary: "นำรูปออกจากแกลเลอรีทรัพย์สิน" })
  removeMedia(@CurrentUser() user: AuthUser, @Param("id") id: string, @Param("mediaId") mediaId: string) {
    return this.relations.removeMedia(user, id, mediaId);
  }

  @Can("asset.read")
  @Get("agreements")
  @ApiOperation({ summary: "ดูประวัติสัญญาฝากเช่า/ฝากขายของทรัพย์สิน" })
  listAgreements(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.relations.listAgreements(user, id);
  }

  @Can("asset.write")
  @Post("agreements")
  @ApiOperation({ summary: "เพิ่มสัญญาฝากเช่า/ฝากขายใหม่ (เก็บเป็นประวัติ ไม่เขียนทับเดิม)" })
  createAgreement(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodPipe(CreateAgreementSchema)) body: z.infer<typeof CreateAgreementSchema>,
  ) {
    return this.relations.createAgreement(user, id, body);
  }
}
