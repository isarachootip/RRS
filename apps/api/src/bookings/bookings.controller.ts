import { Body, Controller, Get, HttpCode, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { AuthUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/public.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { Can } from "../rbac/can.decorator";
import { BookingsService } from "./bookings.service";
import {
  type CancelBookingDto,
  type CreateBookingDto,
  cancelBookingSchema,
  createBookingSchema,
  type ListBookingsQueryDto,
  listBookingsQuerySchema,
  type PayBookingDto,
  payBookingSchema,
} from "./bookings.types";

@ApiTags("bookings")
@ApiBearerAuth()
@Controller("bookings")
export class BookingsController {
  constructor(private readonly service: BookingsService) {}

  @Can("booking.read")
  @Get()
  @ApiOperation({ summary: "ดึงรายการการจองตามตัวกรองและสิทธิ์" })
  list(@CurrentUser() user: AuthUser, @Query(new ZodPipe(listBookingsQuerySchema)) query: ListBookingsQueryDto) {
    return this.service.list(user, query);
  }

  @Can("booking.read")
  @Get(":id")
  @ApiOperation({ summary: "ดูรายละเอียดการจองรายรายการ" })
  getById(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.getById(user, id);
  }

  @Can("booking.write")
  @Post()
  @ApiOperation({ summary: "สร้างการจองห้องเช่า (รอชำระ หรือชำระเงินทันทีพร้อมล็อกช่วงวันที่)" })
  create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(createBookingSchema)) body: CreateBookingDto) {
    return this.service.create(user, body);
  }

  @Can("booking.write")
  @Post(":id/pay")
  @HttpCode(200)
  @ApiOperation({ summary: "ยืนยันรับชำระเงินจอง (ล็อกช่วงวันที่ และเปลี่ยนสถานะห้อง/Lead เป็น จอง)" })
  pay(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodPipe(payBookingSchema)) body: PayBookingDto,
  ) {
    return this.service.pay(user, id, body);
  }

  @Can("booking.write")
  @Post(":id/cancel")
  @HttpCode(200)
  @ApiOperation({ summary: "ยกเลิกการจอง (ระบุเหตุผล และยึดหรือคืนเงินจอง)" })
  cancel(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodPipe(cancelBookingSchema)) body: CancelBookingDto,
  ) {
    return this.service.cancel(user, id, body);
  }
}
