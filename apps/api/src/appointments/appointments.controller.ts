import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { AuthUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/public.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { Can } from "../rbac/can.decorator";
import { AppointmentsService } from "./appointments.service";
import {
  type CalendarQueryInput,
  type CheckOverlapQueryInput,
  type CreateAppointmentInput,
  type RescheduleAppointmentInput,
  type UpdateAppointmentStatusInput,
  calendarQuerySchema,
  checkOverlapQuerySchema,
  createAppointmentSchema,
  rescheduleAppointmentSchema,
  updateAppointmentStatusSchema,
} from "./appointments.types";

@ApiTags("appointments")
@ApiBearerAuth()
@Controller("appointments")
export class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Can("appointment.read")
  @Get("calendar")
  @ApiOperation({ summary: "ดึงรายการนัดหมายสำหรับปฏิทินทีม (Agent เห็นนัดคนอื่นเป็น 'ไม่ว่าง')" })
  listCalendar(@CurrentUser() user: AuthUser, @Query(new ZodPipe(calendarQuerySchema)) query: CalendarQueryInput) {
    return this.appointments.listCalendar(user, query);
  }

  @Can("appointment.read")
  @Get()
  @ApiOperation({ summary: "รายการนัดหมายตามตัวกรองและสิทธิ์" })
  list(@CurrentUser() user: AuthUser, @Query(new ZodPipe(calendarQuerySchema)) query: CalendarQueryInput) {
    return this.appointments.listCalendar(user, query);
  }

  @Can("appointment.write")
  @Get("check-overlap")
  @ApiOperation({ summary: "ตรวจสอบนัดหมายซ้อนของ Agent ในช่วงเวลาเดียวกัน (tstzrange)" })
  async checkOverlap(@Query(new ZodPipe(checkOverlapQuerySchema)) query: CheckOverlapQueryInput) {
    const overlaps = await this.appointments.findOverlaps(
      query.agentId,
      new Date(query.startsAt),
      new Date(query.endsAt),
      query.excludeId,
    );
    return { hasOverlap: overlaps.length > 0, overlaps };
  }

  @Can("appointment.read")
  @Get(":id")
  @ApiOperation({ summary: "ดูรายละเอียดนัดหมายรายรายการ" })
  getById(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.appointments.getById(user, id);
  }

  @Can("appointment.write")
  @Post()
  @ApiOperation({ summary: "สร้างนัดหมายดูห้อง (รองรับหลายห้องในครั้งเดียว พร้อมตรวจนัดซ้อน)" })
  create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(createAppointmentSchema)) body: CreateAppointmentInput) {
    return this.appointments.create(user, body);
  }

  @Can("appointment.write")
  @Patch(":id/status")
  @ApiOperation({ summary: "เปลี่ยนสถานะนัดหมาย (รอยืนยัน / ยืนยันแล้ว / นัดสำเร็จ / ยกเลิก / ไม่มาตามนัด)" })
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodPipe(updateAppointmentStatusSchema)) body: UpdateAppointmentStatusInput,
  ) {
    return this.appointments.updateStatus(user, id, body);
  }

  @Can("appointment.write")
  @Post(":id/reschedule")
  @ApiOperation({ summary: "เลื่อนนัดหมาย (เปลี่ยนนัดเดิมเป็น RESCHEDULED และสร้างนัดใหม่ผูก rescheduledFromId)" })
  reschedule(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodPipe(rescheduleAppointmentSchema)) body: RescheduleAppointmentInput,
  ) {
    return this.appointments.reschedule(user, id, body);
  }
}
