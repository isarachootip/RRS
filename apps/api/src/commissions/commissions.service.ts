import { Injectable, NotFoundException } from "@nestjs/common";
import { AuditService } from "../audit/audit.service";
import type { AuthUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { DataScopeService } from "../rbac/data-scope.service";
import { createPayoutTx, listPayoutsHelper, payPayoutTx } from "./commissions-batch-payout.helper";
import { approveCommissionTx, receiveOwnerPaymentTx } from "./commissions-payout.helper";
import { buildCommissionScopeWhere, COMMISSION_INCLUDE, formatCommissionResponse } from "./commissions-query.helper";
import { calculateAndSaveSplitsTx } from "./commissions.helper";
import type {
  ApproveCommissionDto,
  CalculateCommissionSplitsDto,
  CreateCommissionPayoutDto,
  ListCommissionsQueryDto,
  PayCommissionPayoutDto,
  ReceiveOwnerPaymentDto,
} from "./commissions.types";

@Injectable()
export class CommissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataScope: DataScopeService,
    private readonly audit: AuditService,
  ) {}

  async list(user: AuthUser, query: ListCommissionsQueryDto) {
    const scope = this.dataScope.scopeFor(user, "commission.read");
    const items = await this.prisma.commission.findMany({
      where: {
        ...buildCommissionScopeWhere(scope, user),
        ...(query.status ? { status: query.status } : {}),
        ...(query.assetId ? { assetId: query.assetId } : {}),
        ...(query.contractId ? { contractId: query.contractId } : {}),
        ...(query.saleDealId ? { saleDealId: query.saleDealId } : {}),
      },
      include: COMMISSION_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
    return items.map((c) => formatCommissionResponse(c, user, scope));
  }

  async findOne(user: AuthUser, id: string) {
    const scope = this.dataScope.scopeFor(user, "commission.read");
    const item = await this.prisma.commission.findFirst({
      where: { id, ...buildCommissionScopeWhere(scope, user) },
      include: COMMISSION_INCLUDE,
    });
    if (!item) {
      throw new NotFoundException({ code: "COMMISSION_NOT_FOUND", message: "ไม่พบรายการค่านายหน้า" });
    }
    return formatCommissionResponse(item, user, scope);
  }

  async saveSplits(user: AuthUser, id: string, input: CalculateCommissionSplitsDto) {
    const existing = await this.prisma.commission.findUnique({
      where: { id },
      include: COMMISSION_INCLUDE,
    });
    if (!existing) {
      throw new NotFoundException({ code: "COMMISSION_NOT_FOUND", message: "ไม่พบรายการค่านายหน้า" });
    }

    const res = await calculateAndSaveSplitsTx(this.prisma, existing, input, user.id);
    await this.audit.log({
      action: "UPDATE",
      entityType: "Commission",
      entityId: id,
      actorId: user.id,
      before: {
        revision: existing.currentRevision,
        totalAmount: existing.totalAmount.toString(),
        status: existing.status,
      },
      after: {
        revision: res.targetRevision,
        totalAmount: res.totalAmount,
        status: "PENDING_REVIEW",
        reason: input.reason ?? null,
      },
    });
    return this.findOne(user, id);
  }

  async approve(user: AuthUser, id: string, input: ApproveCommissionDto) {
    const existing = await this.prisma.commission.findUnique({
      where: { id },
      include: COMMISSION_INCLUDE,
    });
    if (!existing) {
      throw new NotFoundException({ code: "COMMISSION_NOT_FOUND", message: "ไม่พบรายการค่านายหน้า" });
    }

    const res = await approveCommissionTx(this.prisma, existing, input, user.id);
    await this.audit.log({
      action: "APPROVE",
      entityType: "Commission",
      entityId: id,
      actorId: user.id,
      before: { status: existing.status, revision: existing.currentRevision },
      after: { status: res.nextStatus, revision: res.revision },
    });
    return this.findOne(user, id);
  }

  async receiveOwnerPayment(user: AuthUser, id: string, input: ReceiveOwnerPaymentDto) {
    const existing = await this.prisma.commission.findUnique({
      where: { id },
      include: COMMISSION_INCLUDE,
    });
    if (!existing) {
      throw new NotFoundException({ code: "COMMISSION_NOT_FOUND", message: "ไม่พบรายการค่านายหน้า" });
    }

    const payment = await receiveOwnerPaymentTx(this.prisma, existing, input, user.id);
    await this.audit.log({
      action: "STATUS_CHANGE",
      entityType: "Commission",
      entityId: id,
      actorId: user.id,
      before: { status: existing.status },
      after: {
        status: "RECEIVED",
        paymentId: payment.id,
        amount: payment.amount.toString(),
        proofFileId: payment.proofFileId,
      },
    });
    return this.findOne(user, id);
  }

  async listPayouts(user: AuthUser) {
    const scope = this.dataScope.scopeFor(user, "commission.read");
    return listPayoutsHelper(this.prisma, user, scope);
  }

  async createPayout(user: AuthUser, input: CreateCommissionPayoutDto) {
    const payout = await createPayoutTx(this.prisma, input, user.id);
    await this.audit.log({
      action: "CREATE",
      entityType: "CommissionPayout",
      entityId: payout.id,
      actorId: user.id,
      after: {
        userId: payout.userId,
        periodLabel: payout.periodLabel,
        totalAmount: payout.totalAmount.toString(),
        status: payout.status,
        proofFileId: payout.proofFileId,
      },
    });
    return payout;
  }

  async payPayout(user: AuthUser, payoutId: string, input: PayCommissionPayoutDto) {
    const payout = await payPayoutTx(this.prisma, payoutId, input, user.id);
    await this.audit.log({
      action: "STATUS_CHANGE",
      entityType: "CommissionPayout",
      entityId: payout.id,
      actorId: user.id,
      after: {
        status: payout.status,
        paidAt: payout.paidAt?.toISOString() ?? null,
        method: payout.method,
        proofFileId: payout.proofFileId,
      },
    });
    return payout;
  }
}
