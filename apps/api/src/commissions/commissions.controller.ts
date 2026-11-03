import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query } from "@nestjs/common";
import type { AuthUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/public.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { Can } from "../rbac/can.decorator";
import { CommissionsService } from "./commissions.service";
import {
  ApproveCommissionSchema,
  CalculateCommissionSplitsSchema,
  CreateCommissionPayoutSchema,
  ListCommissionsQuerySchema,
  PayCommissionPayoutSchema,
  ReceiveOwnerPaymentSchema,
  type ApproveCommissionDto,
  type CalculateCommissionSplitsDto,
  type CreateCommissionPayoutDto,
  type ListCommissionsQueryDto,
  type PayCommissionPayoutDto,
  type ReceiveOwnerPaymentDto,
} from "./commissions.types";

@Controller("commissions")
export class CommissionsController {
  constructor(private readonly commissionsService: CommissionsService) {}

  @Get()
  @Can("commission.read")
  list(@CurrentUser() user: AuthUser, @Query(new ZodPipe(ListCommissionsQuerySchema)) query: ListCommissionsQueryDto) {
    return this.commissionsService.list(user, query);
  }

  @Get("payouts")
  @Can("commission.read")
  listPayouts(@CurrentUser() user: AuthUser) {
    return this.commissionsService.listPayouts(user);
  }

  @Post("payouts")
  @Can("commission.payout")
  createPayout(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(CreateCommissionPayoutSchema)) body: CreateCommissionPayoutDto,
  ) {
    return this.commissionsService.createPayout(user, body);
  }

  @Post("payouts/:payoutId/pay")
  @Can("commission.payout")
  payPayout(
    @CurrentUser() user: AuthUser,
    @Param("payoutId", ParseUUIDPipe) payoutId: string,
    @Body(new ZodPipe(PayCommissionPayoutSchema)) body: PayCommissionPayoutDto,
  ) {
    return this.commissionsService.payPayout(user, payoutId, body);
  }

  @Get(":id")
  @Can("commission.read")
  findOne(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.commissionsService.findOne(user, id);
  }

  @Put(":id/splits")
  @Can("commission.split.edit", "commission.approve")
  saveSplits(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodPipe(CalculateCommissionSplitsSchema)) body: CalculateCommissionSplitsDto,
  ) {
    return this.commissionsService.saveSplits(user, id, body);
  }

  @Post(":id/approve")
  @Can("commission.approve")
  approve(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodPipe(ApproveCommissionSchema)) body: ApproveCommissionDto,
  ) {
    return this.commissionsService.approve(user, id, body);
  }

  @Post(":id/receive")
  @Can("commission.approve")
  receiveOwnerPayment(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodPipe(ReceiveOwnerPaymentSchema)) body: ReceiveOwnerPaymentDto,
  ) {
    return this.commissionsService.receiveOwnerPayment(user, id, body);
  }
}
