import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import type { AuthUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/public.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { Can } from "../rbac/can.decorator";
import { FinanceService } from "./finance.service";
import {
  CreateExpenseSchema,
  CreatePaymentSchema,
  ListExpensesQuerySchema,
  ListPaymentsQuerySchema,
  ListRentSchedulesQuerySchema,
  OwnerNetIncomeQuerySchema,
  UpdateRentScheduleStatusSchema,
  type CreateExpenseDto,
  type CreatePaymentDto,
  type ListExpensesQueryDto,
  type ListPaymentsQueryDto,
  type ListRentSchedulesQueryDto,
  type OwnerNetIncomeQueryDto,
  type UpdateRentScheduleStatusDto,
} from "./finance.types";

@Controller("finance")
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get("payments")
  @Can("payment.read")
  listPayments(
    @CurrentUser() user: AuthUser,
    @Query(new ZodPipe(ListPaymentsQuerySchema)) query: ListPaymentsQueryDto,
  ) {
    return this.financeService.listPayments(user, query);
  }

  @Post("payments")
  @Can("payment.write")
  createPayment(@CurrentUser() user: AuthUser, @Body(new ZodPipe(CreatePaymentSchema)) body: CreatePaymentDto) {
    return this.financeService.createPayment(user, body);
  }

  @Delete("payments/:id")
  @Can("payment.write")
  archivePayment(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.financeService.archivePayment(user, id);
  }

  @Get("rent-schedules")
  @Can("contract.read")
  listRentSchedules(
    @CurrentUser() user: AuthUser,
    @Query(new ZodPipe(ListRentSchedulesQuerySchema)) query: ListRentSchedulesQueryDto,
  ) {
    return this.financeService.listRentSchedules(user, query);
  }

  @Post("contracts/:contractId/generate-schedules")
  @Can("contract.write")
  generateSchedulesForContract(@CurrentUser() user: AuthUser, @Param("contractId", ParseUUIDPipe) contractId: string) {
    return this.financeService.generateSchedulesForContract(user, contractId);
  }

  @Patch("rent-schedules/:id/status")
  @Can("payment.write")
  updateRentScheduleStatus(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodPipe(UpdateRentScheduleStatusSchema)) body: UpdateRentScheduleStatusDto,
  ) {
    return this.financeService.updateRentScheduleStatus(user, id, body);
  }

  @Get("expenses")
  @Can("expense.read")
  listExpenses(
    @CurrentUser() user: AuthUser,
    @Query(new ZodPipe(ListExpensesQuerySchema)) query: ListExpensesQueryDto,
  ) {
    return this.financeService.listExpenses(user, query);
  }

  @Post("expenses")
  @Can("expense.write")
  createExpense(@CurrentUser() user: AuthUser, @Body(new ZodPipe(CreateExpenseSchema)) body: CreateExpenseDto) {
    return this.financeService.createExpense(user, body);
  }

  @Delete("expenses/:id")
  @Can("expense.write")
  archiveExpense(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.financeService.archiveExpense(user, id);
  }

  @Get("reports/owner-net-income")
  @Can("report.read")
  getOwnerNetIncomeReport(
    @CurrentUser() user: AuthUser,
    @Query(new ZodPipe(OwnerNetIncomeQuerySchema)) query: OwnerNetIncomeQueryDto,
  ) {
    return this.financeService.getOwnerNetIncomeReport(user, query);
  }
}
