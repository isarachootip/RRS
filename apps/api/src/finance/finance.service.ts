import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@rrs/db";
import { AuditService } from "../audit/audit.service";
import type { AuthUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { DataScopeService } from "../rbac/data-scope.service";
import { createExpenseRecord, createPaymentTx, monthDateRange } from "./finance-mutations.helper";
import type {
  CreateExpenseDto,
  CreatePaymentDto,
  ListExpensesQueryDto,
  ListPaymentsQueryDto,
  ListRentSchedulesQueryDto,
  OwnerNetIncomeQueryDto,
  UpdateRentScheduleStatusDto,
} from "./finance.types";
import { computeOwnerNetIncomeReport } from "./owner-report.helper";
import { generateRentSchedulesTx, recomputeRentScheduleFromPaymentsTx } from "./rent-schedules.helper";

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataScope: DataScopeService,
    private readonly audit: AuditService,
  ) {}

  async listPayments(_user: AuthUser, query: ListPaymentsQueryDto) {
    const range = monthDateRange(query.year, query.month);
    return this.prisma.payment.findMany({
      where: {
        archivedAt: null,
        ...(query.assetId ? { assetId: query.assetId } : {}),
        ...(query.contractId ? { contractId: query.contractId } : {}),
        ...(query.bookingId ? { bookingId: query.bookingId } : {}),
        ...(query.saleDealId ? { saleDealId: query.saleDealId } : {}),
        ...(query.rentScheduleId ? { rentScheduleId: query.rentScheduleId } : {}),
        ...(query.type ? { type: query.type } : {}),
        ...(query.direction ? { direction: query.direction } : {}),
        ...(range ? { paidAt: range } : {}),
      },
      include: {
        asset: { select: { id: true, code: true, unitNo: true, ownershipType: true } },
        receivedBy: { select: { id: true, fullName: true } },
        rentSchedule: { select: { id: true, periodStart: true, dueDate: true, status: true } },
      },
      orderBy: { paidAt: "desc" },
    });
  }

  async createPayment(user: AuthUser, input: CreatePaymentDto) {
    const { created, amountStr, receivedById } = await createPaymentTx(this.prisma, input, user.id);
    await this.audit.log({
      action: "CREATE",
      entityType: "Payment",
      entityId: created.id,
      actorId: user.id,
      after: {
        type: created.type,
        direction: created.direction,
        amount: amountStr,
        paidAt: created.paidAt.toISOString(),
        method: created.method,
        receivedById,
        proofFileId: created.proofFileId,
        rentScheduleId: created.rentScheduleId,
      },
    });
    return created;
  }

  async archivePayment(user: AuthUser, id: string) {
    const existing = await this.prisma.payment.findFirst({ where: { id, archivedAt: null } });
    if (!existing) throw new NotFoundException({ code: "NOT_FOUND", message: "ไม่พบรายการรับ/จ่ายเงิน" });

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({ where: { id }, data: { archivedAt: new Date(), archivedById: user.id } });
      if (existing.rentScheduleId) await recomputeRentScheduleFromPaymentsTx(tx, existing.rentScheduleId);
    });
    await this.audit.log({
      action: "ARCHIVE",
      entityType: "Payment",
      entityId: id,
      actorId: user.id,
      before: { amount: existing.amount.toString(), type: existing.type },
    });
    return { archived: true };
  }

  async listRentSchedules(_user: AuthUser, query: ListRentSchedulesQueryDto) {
    const range = monthDateRange(query.year, query.month);
    return this.prisma.rentSchedule.findMany({
      where: {
        ...(query.contractId ? { contractId: query.contractId } : {}),
        ...(query.assetId ? { contract: { assetId: query.assetId } } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(range ? { dueDate: range } : {}),
      },
      include: {
        contract: {
          select: {
            id: true,
            contractNo: true,
            asset: { select: { id: true, code: true, unitNo: true, ownershipType: true } },
            lead: { select: { id: true, code: true, fullName: true } },
          },
        },
        payments: { where: { archivedAt: null }, orderBy: { paidAt: "desc" } },
      },
      orderBy: [{ dueDate: "asc" }],
    });
  }

  async generateSchedulesForContract(user: AuthUser, contractId: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: { asset: { select: { ownershipType: true } } },
    });
    if (!contract) throw new NotFoundException({ code: "NOT_FOUND", message: "ไม่พบสัญญาเช่า" });
    if (contract.asset.ownershipType !== "OWNER") {
      throw new BadRequestException({
        code: "NOT_OWNER_ASSET",
        message: "สร้างงวดค่าเช่ารายเดือนอัตโนมัติได้เฉพาะสัญญาของห้องประเภท OWNER เท่านั้น",
      });
    }
    const schedules = await this.prisma.$transaction((tx) => generateRentSchedulesTx(tx, contractId));
    await this.audit.log({
      action: "CREATE",
      entityType: "RentSchedule",
      entityId: contractId,
      actorId: user.id,
      after: { count: schedules.length },
    });
    return schedules;
  }

  async updateRentScheduleStatus(user: AuthUser, id: string, input: UpdateRentScheduleStatusDto) {
    const existing = await this.prisma.rentSchedule.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException({ code: "NOT_FOUND", message: "ไม่พบงวดค่าเช่า" });
    const updated = await this.prisma.rentSchedule.update({ where: { id }, data: { status: input.status } });
    await this.audit.log({
      action: "STATUS_CHANGE",
      entityType: "RentSchedule",
      entityId: id,
      actorId: user.id,
      before: { status: existing.status },
      after: { status: updated.status },
    });
    return updated;
  }

  async listExpenses(_user: AuthUser, query: ListExpensesQueryDto) {
    const range = monthDateRange(query.year, query.month);
    return this.prisma.expense.findMany({
      where: {
        archivedAt: null,
        ...(query.assetId ? { assetId: query.assetId } : {}),
        ...(query.category ? { category: query.category } : {}),
        ...(range ? { incurredAt: range } : {}),
      },
      include: { asset: { select: { id: true, code: true, unitNo: true, ownershipType: true } } },
      orderBy: { incurredAt: "desc" },
    });
  }

  async createExpense(user: AuthUser, input: CreateExpenseDto) {
    const { created, amountStr } = await createExpenseRecord(this.prisma, input, user.id);
    await this.audit.log({
      action: "CREATE",
      entityType: "Expense",
      entityId: created.id,
      actorId: user.id,
      after: { assetId: created.assetId, category: created.category, amount: amountStr },
    });
    return created;
  }

  async archiveExpense(user: AuthUser, id: string) {
    const existing = await this.prisma.expense.findFirst({ where: { id, archivedAt: null } });
    if (!existing) throw new NotFoundException({ code: "NOT_FOUND", message: "ไม่พบรายการค่าใช้จ่าย" });
    await this.prisma.expense.update({ where: { id }, data: { archivedAt: new Date() } });
    await this.audit.log({
      action: "ARCHIVE",
      entityType: "Expense",
      entityId: id,
      actorId: user.id,
      before: { amount: existing.amount.toString(), category: existing.category },
    });
    return { archived: true };
  }

  async getOwnerNetIncomeReport(user: AuthUser, query: OwnerNetIncomeQueryDto) {
    const assetScope = this.dataScope.where(user, "assets", "asset.read") as Prisma.AssetWhereInput;
    return computeOwnerNetIncomeReport(this.prisma, assetScope, query);
  }
}
