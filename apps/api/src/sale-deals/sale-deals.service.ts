import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { nextCode, type Prisma } from "@rrs/db";
import type { PermissionCode } from "@rrs/shared";
import { AssetStatusService } from "../assets/asset-status.service";
import { AuditService } from "../audit/audit.service";
import type { AuthUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { DataScopeService } from "../rbac/data-scope.service";
import { SALE_DEAL_INCLUDE, syncSaleSideEffectsTx } from "./sale-deals.helper";
import type { CreateSaleDealDto, ListSaleDealsQueryDto, UpdateSaleDealDto } from "./sale-deals.types";

@Injectable()
export class SaleDealsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataScope: DataScopeService,
    private readonly audit: AuditService,
    private readonly assetStatus: AssetStatusService,
  ) {}

  private scopeWhere(user: AuthUser, perm: PermissionCode): Prisma.SaleDealWhereInput {
    const scope = this.dataScope.scopeFor(user, perm);
    if (scope === "ALL") return {};
    if (scope === "TEAM" && user.teamId) {
      return {
        OR: [
          { agent: { teamId: user.teamId } },
          { lead: { ownerAgent: { teamId: user.teamId } } },
          { asset: { primaryAgent: { teamId: user.teamId } } },
        ],
      };
    }
    return {
      OR: [{ agentId: user.id }, { lead: { ownerAgentId: user.id } }, { asset: { primaryAgentId: user.id } }],
    };
  }

  async list(user: AuthUser, query: ListSaleDealsQueryDto) {
    const scope = this.scopeWhere(user, "sale.read");
    return this.prisma.saleDeal.findMany({
      where: {
        ...scope,
        ...(query.stage ? { stage: query.stage } : {}),
        ...(query.assetId ? { assetId: query.assetId } : {}),
        ...(query.leadId ? { leadId: query.leadId } : {}),
        ...(query.agentId ? { agentId: query.agentId } : {}),
      },
      include: SALE_DEAL_INCLUDE,
      orderBy: { updatedAt: "desc" },
    });
  }

  async getById(user: AuthUser, id: string) {
    const scope = this.scopeWhere(user, "sale.read");
    const deal = await this.prisma.saleDeal.findFirst({
      where: { ...scope, id },
      include: SALE_DEAL_INCLUDE,
    });
    if (!deal) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "ไม่พบข้อมูลดีลขาย" });
    }
    return deal;
  }

  async create(user: AuthUser, input: CreateSaleDealDto) {
    const [lead, asset] = await Promise.all([
      this.prisma.lead.findFirst({ where: { id: input.leadId, archivedAt: null } }),
      this.prisma.asset.findFirst({ where: { id: input.assetId, archivedAt: null } }),
    ]);
    if (!lead) throw new NotFoundException({ code: "LEAD_NOT_FOUND", message: "ไม่พบข้อมูลลูกค้า" });
    if (!asset) throw new NotFoundException({ code: "ASSET_NOT_FOUND", message: "ไม่พบทรัพย์สิน" });

    const created = await this.prisma.$transaction(async (tx) => {
      const code = await nextCode(tx, "SD", "SD-");
      const deal = await tx.saleDeal.create({
        data: {
          code,
          leadId: lead.id,
          assetId: asset.id,
          ownerId: asset.ownerId,
          agentId: input.agentId ?? user.id,
          stage: input.stage ?? "INTERESTED",
          askingPrice: input.askingPrice ?? asset.salePrice ?? null,
          offeredPrice: input.offeredPrice ?? null,
          agreedPrice: input.agreedPrice ?? null,
          depositAmount: input.depositAmount ?? null,
          spaSignedAt: input.spaSignedAt ? new Date(input.spaSignedAt) : null,
          transferDate: input.transferDate ? new Date(input.transferDate) : null,
          transferFeePayer: input.transferFeePayer ?? null,
          loanBank: input.loanBank ?? null,
          commissionFormula: input.commissionFormula ?? "PERCENT_SALE_PRICE",
          commissionParams: (input.commissionParams ?? { percent: 3 }) as Prisma.InputJsonValue,
          note: input.note ?? null,
          createdById: user.id,
          updatedById: user.id,
        },
      });
      await syncSaleSideEffectsTx(tx, deal, asset.ownershipType, Number(asset.salePrice ?? 0), user.id);
      return deal;
    });

    await this.assetStatus.recompute(asset.id, user.id);
    await this.audit.log({
      action: "CREATE",
      entityType: "SaleDeal",
      entityId: created.id,
      actorId: user.id,
      after: { code: created.code, stage: created.stage, assetId: asset.id },
    });
    return this.getById(user, created.id);
  }

  async update(user: AuthUser, id: string, input: UpdateSaleDealDto) {
    const existing = await this.getById(user, id);
    if (input.stage === "CANCELLED" && !input.cancelReason && !existing.cancelReason) {
      throw new BadRequestException({
        code: "CANCEL_REASON_REQUIRED",
        message: "กรุณาระบุเหตุผลการยกเลิกดีลขาย",
      });
    }

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.saleDeal.update({
        where: { id },
        data: {
          ...(input.stage ? { stage: input.stage } : {}),
          ...(input.askingPrice !== undefined ? { askingPrice: input.askingPrice } : {}),
          ...(input.offeredPrice !== undefined ? { offeredPrice: input.offeredPrice } : {}),
          ...(input.agreedPrice !== undefined ? { agreedPrice: input.agreedPrice } : {}),
          ...(input.depositAmount !== undefined ? { depositAmount: input.depositAmount } : {}),
          ...(input.spaSignedAt !== undefined
            ? { spaSignedAt: input.spaSignedAt ? new Date(input.spaSignedAt) : null }
            : {}),
          ...(input.transferDate !== undefined
            ? { transferDate: input.transferDate ? new Date(input.transferDate) : null }
            : {}),
          ...(input.transferFeePayer !== undefined ? { transferFeePayer: input.transferFeePayer } : {}),
          ...(input.loanBank !== undefined ? { loanBank: input.loanBank } : {}),
          ...(input.commissionFormula ? { commissionFormula: input.commissionFormula } : {}),
          ...(input.commissionParams ? { commissionParams: input.commissionParams as Prisma.InputJsonValue } : {}),
          ...(input.cancelReason !== undefined ? { cancelReason: input.cancelReason } : {}),
          ...(input.note !== undefined ? { note: input.note } : {}),
          updatedById: user.id,
        },
      });
      await syncSaleSideEffectsTx(
        tx,
        updated,
        existing.asset.ownershipType,
        Number(existing.asset.salePrice ?? 0),
        user.id,
      );
    });

    await this.assetStatus.recompute(existing.assetId, user.id);
    await this.audit.log({
      action: input.stage && input.stage !== existing.stage ? "STATUS_CHANGE" : "UPDATE",
      entityType: "SaleDeal",
      entityId: id,
      actorId: user.id,
      before: { stage: existing.stage },
      after: { stage: input.stage ?? existing.stage },
    });
    return this.getById(user, id);
  }
}
