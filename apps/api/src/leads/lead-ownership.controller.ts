import { Body, Controller, Get, HttpCode, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import type { AuthUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/public.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { Can } from "../rbac/can.decorator";
import { LeadOwnershipService } from "./lead-ownership.service";

const TransferLeadSchema = z.object({
  toUserId: z.string().uuid(),
  reason: z.string().trim().min(1, "กรุณาระบุเหตุผลในการโอนลูกค้า").max(500),
});

const RequestCollabSchema = z.object({
  role: z.enum(["FINDER", "LISTING", "SHOWING", "CLOSER"]).default("SHOWING"),
});

const DecideCollabSchema = z.object({
  role: z.enum(["FINDER", "LISTING", "SHOWING", "CLOSER"]).default("SHOWING"),
  status: z.enum(["APPROVED", "REJECTED"]),
});

const AddActivitySchema = z.object({
  type: z.enum(["CALL", "CHAT", "EMAIL", "NOTE", "MEETING", "FOLLOW_UP"]),
  body: z.string().trim().min(1).max(2000),
  outcome: z
    .enum(["LIKED", "NEGOTIATING_PRICE", "WANTS_OTHER_UNITS", "CONSIDERING", "NOT_INTERESTED", "AGREED"])
    .nullish(),
  nextFollowUpAt: z.string().nullish(),
});

const CheckInactiveJobSchema = z.object({
  inactiveDays: z.number().int().min(1).max(365).optional(),
});

@ApiTags("leads")
@ApiBearerAuth()
@Controller("leads")
export class LeadOwnershipController {
  constructor(private readonly ownership: LeadOwnershipService) {}

  @Can("lead.assign")
  @Post(":id/transfer")
  @HttpCode(200)
  @ApiOperation({ summary: "โอนเจ้าของหลักของลูกค้าพร้อมเหตุผล (เฉพาะผู้มีสิทธิ์ lead.assign)" })
  transfer(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodPipe(TransferLeadSchema)) body: z.infer<typeof TransferLeadSchema>,
  ) {
    return this.ownership.transfer(user, id, body.toUserId, body.reason);
  }

  @Can("lead.read")
  @Post(":id/collaborators")
  @ApiOperation({ summary: "ขอเข้าร่วมงานดูแลลูกค้ารายนี้ (รอเจ้าของหรือ Manager อนุมัติ)" })
  requestCollaboration(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodPipe(RequestCollabSchema)) body: z.infer<typeof RequestCollabSchema>,
  ) {
    return this.ownership.requestCollaboration(user, id, body.role);
  }

  @Can("lead.read")
  @Patch(":id/collaborators/:userId")
  @ApiOperation({ summary: "อนุมัติหรือปฏิเสธคำขอร่วมงาน (เฉพาะเจ้าของ Lead หรือ Manager)" })
  decideCollaboration(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Param("userId") targetUserId: string,
    @Body(new ZodPipe(DecideCollabSchema)) body: z.infer<typeof DecideCollabSchema>,
  ) {
    return this.ownership.decideCollaboration(user, id, targetUserId, body.role, body.status);
  }

  @Can("lead.read")
  @Get(":id/activities")
  @ApiOperation({ summary: "ดูไทม์ไลน์ประวัติการติดต่อ (โทร/แชต/โน้ต)" })
  listActivities(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.ownership.listActivities(user, id);
  }

  @Can("lead.write")
  @Post(":id/activities")
  @ApiOperation({ summary: "บันทึกการโทร/แชต/โน้ต พร้อมวันติดตามครั้งถัดไป" })
  addActivity(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodPipe(AddActivitySchema)) body: z.infer<typeof AddActivitySchema>,
  ) {
    return this.ownership.addActivity(user, id, body);
  }

  @Can("lead.assign")
  @Post("jobs/check-inactive")
  @HttpCode(200)
  @ApiOperation({ summary: "Job รายวัน: ตรวจ Lead ที่ไม่มีกิจกรรมเกิน N วัน (ค่าเริ่มต้น 30 วัน) แล้วแจ้ง Manager" })
  checkInactive(@Body(new ZodPipe(CheckInactiveJobSchema)) body: z.infer<typeof CheckInactiveJobSchema>) {
    return this.ownership.checkInactiveLeads(body.inactiveDays ?? 30);
  }
}
