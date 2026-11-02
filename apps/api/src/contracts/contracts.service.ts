import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { AuditAction, Prisma } from "@rrs/db";
import type { PermissionCode } from "@rrs/shared";
import { AssetStatusService } from "../assets/asset-status.service";
import { AuditService } from "../audit/audit.service";
import type { AuthUser } from "../auth/auth.types";
import { throwIfPeriodOverlap } from "../bookings/bookings.helper";
import { PrismaService } from "../prisma/prisma.service";
import { DataScopeService } from "../rbac/data-scope.service";
import {
  buildRenewDto,
  createContractRecordTx,
  markExpiredContracts,
  updateDraftContract,
} from "./contracts-create.helper";
import { CONTRACT_INCLUDE, reviseActiveContractTx, signContractTx } from "./contracts.helper";
import type {
  CreateContractDto,
  ListContractsQueryDto,
  RenewContractDto,
  ReviseContractDto,
  SignContractDto,
  TerminateContractDto,
} from "./contracts.types";

@Injectable()
export class ContractsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataScope: DataScopeService,
    private readonly audit: AuditService,
    private readonly assetStatus: AssetStatusService,
  ) {}

  private scopeWhere(user: AuthUser, perm: PermissionCode): Prisma.ContractWhereInput {
    const raw = { ...this.dataScope.where(user, "contracts", perm) };
    delete raw.archivedAt;
    return raw as Prisma.ContractWhereInput;
  }

  async list(user: AuthUser, query: ListContractsQueryDto) {
    const scope = this.scopeWhere(user, "contract.read");
    return this.prisma.contract.findMany({
      where: {
        ...scope,
        ...(query.status ? { status: query.status } : query.includeSuperseded ? {} : { status: { not: "SUPERSEDED" } }),
        ...(query.assetId ? { assetId: query.assetId } : {}),
        ...(query.leadId ? { leadId: query.leadId } : {}),
      },
      include: CONTRACT_INCLUDE,
      orderBy: [{ createdAt: "desc" }, { revision: "desc" }],
    });
  }

  async getById(user: AuthUser, id: string) {
    const scope = this.scopeWhere(user, "contract.read");
    const contract = await this.prisma.contract.findFirst({
      where: { ...scope, id },
      include: CONTRACT_INCLUDE,
    });
    if (!contract) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "ไม่พบข้อมูลสัญญาเช่า" });
    }
    return contract;
  }

  async historyByAsset(user: AuthUser, assetId: string) {
    return this.prisma.contract.findMany({
      where: { ...this.scopeWhere(user, "contract.read"), assetId },
      include: CONTRACT_INCLUDE,
      orderBy: [{ startDate: "desc" }, { revision: "desc" }],
    });
  }

  async historyByLead(user: AuthUser, leadId: string) {
    return this.prisma.contract.findMany({
      where: { ...this.scopeWhere(user, "contract.read"), leadId },
      include: CONTRACT_INCLUDE,
      orderBy: [{ startDate: "desc" }, { revision: "desc" }],
    });
  }

  private async logAction(userId: string, action: AuditAction, entityId: string, before?: object, after?: object) {
    await this.audit.log({ action, entityType: "Contract", entityId, actorId: userId, before, after });
  }

  async create(user: AuthUser, input: CreateContractDto) {
    let result: { contractId: string; assetId: string; isActive: boolean };
    try {
      result = await createContractRecordTx(this.prisma, input, user.id);
    } catch (err) {
      const start = input.startDate ? new Date(input.startDate) : new Date();
      const end = input.endDate ? new Date(input.endDate) : new Date();
      if (input.assetId) await throwIfPeriodOverlap(this.prisma, err, input.assetId, start, end);
      throw err;
    }
    await this.assetStatus.recompute(result.assetId, user.id);
    await this.logAction(user.id, "CREATE", result.contractId, undefined, {
      bookingId: input.bookingId,
      status: input.status,
    });
    return this.getById(user, result.contractId);
  }

  async sign(user: AuthUser, id: string, input: SignContractDto) {
    const existing = await this.getById(user, id);
    if (existing.status !== "DRAFT" && existing.status !== "PENDING_SIGNATURE") {
      throw new BadRequestException({
        code: "INVALID_CONTRACT_STATUS",
        message: "สัญญานี้ไม่ได้อยู่ในสถานะฉบับร่างหรือรอลงนาม",
      });
    }
    const signedAt = input.signedAt ? new Date(input.signedAt) : new Date();
    try {
      await signContractTx(this.prisma, existing, signedAt, input, user.id);
    } catch (err) {
      await throwIfPeriodOverlap(this.prisma, err, existing.assetId, existing.startDate, existing.endDate);
      throw err;
    }
    await this.assetStatus.recompute(existing.assetId, user.id);
    await this.logAction(
      user.id,
      "STATUS_CHANGE",
      id,
      { status: existing.status },
      { status: "ACTIVE", signedAt: signedAt.toISOString() },
    );
    return this.getById(user, id);
  }

  async revise(user: AuthUser, id: string, input: ReviseContractDto) {
    const existing = await this.getById(user, id);
    if (existing.status === "DRAFT" || existing.status === "PENDING_SIGNATURE") {
      await updateDraftContract(this.prisma, id, input, user.id);
      return this.getById(user, id);
    }
    if (existing.status !== "ACTIVE") {
      throw new BadRequestException({
        code: "CONTRACT_NOT_REVISABLE",
        message: "แก้ไขได้เฉพาะสัญญาฉบับร่างหรือสัญญาที่มีผลบังคับใช้อยู่เท่านั้น",
      });
    }
    const newContractId = await reviseActiveContractTx(this.prisma, existing, input, user.id);
    await this.assetStatus.recompute(existing.assetId, user.id);
    await this.logAction(
      user.id,
      "UPDATE",
      newContractId,
      { revisionOfId: existing.id, revision: existing.revision },
      { revision: existing.revision + 1 },
    );
    return this.getById(user, newContractId);
  }

  async renew(user: AuthUser, id: string, input: RenewContractDto) {
    const existing = await this.getById(user, id);
    if (existing.status === "ACTIVE" && existing.endDate.getTime() < new Date(input.startDate).getTime()) {
      await this.prisma.contract.update({
        where: { id: existing.id },
        data: { status: "ENDED", updatedById: user.id },
      });
    }
    return this.create(user, buildRenewDto(existing, input));
  }

  async terminate(user: AuthUser, id: string, input: TerminateContractDto) {
    const existing = await this.getById(user, id);
    if (existing.status !== "ACTIVE") {
      throw new BadRequestException({
        code: "CONTRACT_NOT_ACTIVE",
        message: "สามารถยกเลิกก่อนกำหนดได้เฉพาะสัญญาที่มีผลบังคับใช้อยู่เท่านั้น",
      });
    }
    await this.prisma.contract.update({
      where: { id },
      data: {
        status: "TERMINATED",
        terminatedAt: new Date(input.terminatedAt),
        terminationReason: input.terminationReason,
        updatedById: user.id,
      },
    });
    await this.assetStatus.recompute(existing.assetId, user.id);
    await this.logAction(
      user.id,
      "STATUS_CHANGE",
      id,
      { status: existing.status },
      { status: "TERMINATED", terminatedAt: input.terminatedAt, terminationReason: input.terminationReason },
    );
    return this.getById(user, id);
  }

  async expireEndedContracts(asOfDate?: string) {
    const res = await markExpiredContracts(this.prisma, asOfDate);
    if (res.assetIds.length > 0) await this.assetStatus.recomputeMany(res.assetIds);
    return res;
  }
}
