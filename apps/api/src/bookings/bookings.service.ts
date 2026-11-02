import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { nextCode, type Prisma } from "@rrs/db";
import type { PermissionCode } from "@rrs/shared";
import { AssetStatusService } from "../assets/asset-status.service";
import { AuditService } from "../audit/audit.service";
import type { AuthUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { DataScopeService } from "../rbac/data-scope.service";
import { BOOKING_INCLUDE, cancelBookingTx, payBookingTx, throwIfPeriodOverlap } from "./bookings.helper";
import type { CancelBookingDto, CreateBookingDto, ListBookingsQueryDto, PayBookingDto } from "./bookings.types";

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataScope: DataScopeService,
    private readonly audit: AuditService,
    private readonly assetStatus: AssetStatusService,
  ) {}

  private scopeWhere(user: AuthUser, perm: PermissionCode): Prisma.BookingWhereInput {
    const raw = { ...this.dataScope.where(user, "bookings", perm) };
    delete raw.archivedAt;
    return raw as Prisma.BookingWhereInput;
  }

  async list(user: AuthUser, query: ListBookingsQueryDto) {
    const scope = this.scopeWhere(user, "booking.read");
    return this.prisma.booking.findMany({
      where: {
        ...scope,
        ...(query.status ? { status: query.status } : {}),
        ...(query.leadId ? { leadId: query.leadId } : {}),
        ...(query.assetId ? { assetId: query.assetId } : {}),
      },
      include: BOOKING_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
  }

  async getById(user: AuthUser, id: string) {
    const scope = this.scopeWhere(user, "booking.read");
    const booking = await this.prisma.booking.findFirst({
      where: { ...scope, id },
      include: BOOKING_INCLUDE,
    });
    if (!booking) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "ไม่พบข้อมูลการจอง" });
    }
    return booking;
  }

  async create(user: AuthUser, input: CreateBookingDto) {
    const [lead, asset] = await Promise.all([
      this.prisma.lead.findFirst({ where: { id: input.leadId, archivedAt: null } }),
      this.prisma.asset.findFirst({ where: { id: input.assetId, archivedAt: null } }),
    ]);
    if (!lead) throw new NotFoundException({ code: "LEAD_NOT_FOUND", message: "ไม่พบข้อมูลลูกค้า" });
    if (!asset) throw new NotFoundException({ code: "ASSET_NOT_FOUND", message: "ไม่พบทรัพย์สิน" });

    const startDate = new Date(input.startDate);
    const endDate = new Date(input.endDate);
    const now = new Date();
    const receiverId = input.receivedById ?? (input.payImmediately ? user.id : null);

    let bookingId = "";
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const code = await nextCode(tx, "BK", "BK-");
        const bk = await tx.booking.create({
          data: {
            code,
            leadId: input.leadId,
            assetId: input.assetId,
            monthlyRent: input.monthlyRent,
            bookingFee: input.bookingFee,
            securityDeposit: input.securityDeposit,
            advanceRent: input.advanceRent,
            startDate,
            endDate,
            status: input.payImmediately ? "PAID" : "PENDING_PAYMENT",
            paidAt: input.payImmediately ? now : null,
            receivedById: receiverId,
            note: input.note ?? null,
            createdById: user.id,
            updatedById: user.id,
          },
        });
        if (input.payImmediately) {
          await tx.payment.create({
            data: {
              type: "BOOKING_FEE",
              direction: "IN",
              amount: input.bookingFee,
              paidAt: now,
              method: input.paymentMethod ?? "BANK_TRANSFER",
              reference: input.paymentReference ?? null,
              assetId: input.assetId,
              bookingId: bk.id,
              receivedById: receiverId,
              proofFileId: input.proofFileId ?? null,
              createdById: user.id,
            },
          });
          await tx.lead.update({
            where: { id: input.leadId },
            data: { status: "BOOKED", updatedById: user.id },
          });
        }
        return bk;
      });
      bookingId = created.id;
    } catch (err) {
      await throwIfPeriodOverlap(this.prisma, err, input.assetId, startDate, endDate);
      throw err;
    }

    if (input.payImmediately) {
      await this.assetStatus.recompute(input.assetId, user.id);
    }
    await this.audit.log({
      action: "CREATE",
      entityType: "Booking",
      entityId: bookingId,
      actorId: user.id,
      after: { assetId: input.assetId, leadId: input.leadId, payImmediately: input.payImmediately },
    });
    return this.getById(user, bookingId);
  }

  async pay(user: AuthUser, id: string, input: PayBookingDto) {
    const existing = await this.getById(user, id);
    if (existing.status !== "PENDING_PAYMENT") {
      throw new BadRequestException({
        code: "INVALID_BOOKING_STATUS",
        message: "การจองนี้ไม่ได้อยู่ในสถานะรอชำระเงิน",
      });
    }
    const paidAt = input.paidAt ? new Date(input.paidAt) : new Date();
    const receivedById = input.receivedById ?? existing.receivedById ?? user.id;

    try {
      await payBookingTx(
        this.prisma,
        id,
        existing.leadId,
        existing.assetId,
        existing.bookingFee,
        paidAt,
        receivedById,
        user.id,
        input,
      );
    } catch (err) {
      await throwIfPeriodOverlap(this.prisma, err, existing.assetId, existing.startDate, existing.endDate);
      throw err;
    }

    await this.assetStatus.recompute(existing.assetId, user.id);
    await this.audit.log({
      action: "STATUS_CHANGE",
      entityType: "Booking",
      entityId: id,
      actorId: user.id,
      before: { status: existing.status },
      after: { status: "PAID", paidAt: paidAt.toISOString() },
    });
    return this.getById(user, id);
  }

  async cancel(user: AuthUser, id: string, input: CancelBookingDto) {
    const existing = await this.getById(user, id);
    if (existing.status === "CANCELLED" || existing.status === "CONVERTED") {
      throw new BadRequestException({
        code: "INVALID_BOOKING_STATUS",
        message: "ไม่สามารถยกเลิกการจองที่ถูกยกเลิกหรือแปลงเป็นสัญญาแล้วได้",
      });
    }
    await cancelBookingTx(this.prisma, id, existing.assetId, existing.status, existing.bookingFee, user.id, input);
    await this.assetStatus.recompute(existing.assetId, user.id);
    await this.audit.log({
      action: "STATUS_CHANGE",
      entityType: "Booking",
      entityId: id,
      actorId: user.id,
      before: { status: existing.status },
      after: { status: "CANCELLED", cancelReason: input.cancelReason, feeForfeited: input.feeForfeited },
    });
    return this.getById(user, id);
  }
}
