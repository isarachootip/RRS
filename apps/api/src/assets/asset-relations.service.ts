import { ForbiddenException, Injectable } from "@nestjs/common";
import type { AgreementStatus, AssetAgentRole, CommissionFormula, Prisma, TransactionType } from "@rrs/db";
import type { AuthUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { DataScopeService } from "../rbac/data-scope.service";

export interface CreateAgreementInput {
  transactionType: TransactionType;
  startDate: string;
  endDate?: string | null;
  commissionFormula: CommissionFormula;
  commissionParams?: Record<string, unknown>;
  exclusive?: boolean;
  status?: AgreementStatus;
  fileId?: string | null;
  note?: string | null;
}

@Injectable()
export class AssetRelationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataScope: DataScopeService,
  ) {}

  private async ensureWritableAsset(user: AuthUser, assetId: string) {
    const scopedWhere = this.dataScope.where(user, "assets", "asset.write") as Prisma.AssetWhereInput;
    const asset = await this.prisma.asset.findFirst({ where: { AND: [{ id: assetId }, scopedWhere] } });
    if (!asset) {
      throw new ForbiddenException({ code: "FORBIDDEN", message: "คุณไม่มีสิทธิ์แก้ไขข้อมูลทรัพย์สินรายการนี้" });
    }
    return asset;
  }

  async setAgents(user: AuthUser, assetId: string, agents: Array<{ userId: string; role: AssetAgentRole }>) {
    await this.ensureWritableAsset(user, assetId);
    const listingAgent = agents.find((a) => a.role === "LISTING") ?? agents[0];

    await this.prisma.$transaction([
      this.prisma.assetAgent.deleteMany({ where: { assetId } }),
      ...(agents.length > 0
        ? [
            this.prisma.assetAgent.createMany({
              data: agents.map((a) => ({ assetId, userId: a.userId, role: a.role })),
            }),
          ]
        : []),
    ]);

    const updated = await this.prisma.asset.update({
      where: { id: assetId },
      data: {
        ...(listingAgent ? { primaryAgentId: listingAgent.userId } : {}),
        updatedById: user.id,
      },
      include: {
        agents: { include: { user: { select: { id: true, fullName: true, teamId: true } } } },
      },
    });

    return { agents: updated.agents };
  }

  async addMedia(
    user: AuthUser,
    assetId: string,
    input: { fileId: string; caption?: string | null; isCover?: boolean },
  ) {
    await this.ensureWritableAsset(user, assetId);
    const count = await this.prisma.assetMedia.count({ where: { assetId } });
    const isCover = input.isCover ?? count === 0;

    if (isCover) {
      await this.prisma.assetMedia.updateMany({ where: { assetId }, data: { isCover: false } });
    }

    const media = await this.prisma.assetMedia.create({
      data: {
        assetId,
        fileId: input.fileId,
        sortOrder: count,
        caption: input.caption ?? null,
        isCover,
      },
      include: { file: true },
    });

    await this.prisma.asset.update({ where: { id: assetId }, data: { updatedById: user.id } });
    return media;
  }

  async reorderMedia(user: AuthUser, assetId: string, input: { orderedIds: string[]; coverMediaId?: string }) {
    await this.ensureWritableAsset(user, assetId);

    for (let i = 0; i < input.orderedIds.length; i++) {
      const mediaId = input.orderedIds[i]!;
      await this.prisma.assetMedia.updateMany({
        where: { id: mediaId, assetId },
        data: {
          sortOrder: i,
          ...(input.coverMediaId !== undefined ? { isCover: mediaId === input.coverMediaId } : {}),
        },
      });
    }

    await this.prisma.asset.update({ where: { id: assetId }, data: { updatedById: user.id } });
    const items = await this.prisma.assetMedia.findMany({
      where: { assetId },
      orderBy: { sortOrder: "asc" },
      include: { file: true },
    });
    return { items };
  }

  async removeMedia(user: AuthUser, assetId: string, mediaId: string) {
    await this.ensureWritableAsset(user, assetId);
    await this.prisma.assetMedia.deleteMany({ where: { id: mediaId, assetId } });
    await this.prisma.asset.update({ where: { id: assetId }, data: { updatedById: user.id } });
    return { ok: true };
  }

  async listAgreements(user: AuthUser, assetId: string) {
    const scopedWhere = this.dataScope.where(user, "assets", "asset.read") as Prisma.AssetWhereInput;
    const asset = await this.prisma.asset.findFirst({ where: { AND: [{ id: assetId }, scopedWhere] } });
    if (!asset) {
      throw new ForbiddenException({ code: "FORBIDDEN", message: "คุณไม่มีสิทธิ์ดูสัญญาฝากของทรัพย์สินนี้" });
    }
    const items = await this.prisma.listingAgreement.findMany({
      where: { assetId, archivedAt: null },
      orderBy: { createdAt: "desc" },
    });
    return { items };
  }

  async createAgreement(user: AuthUser, assetId: string, input: CreateAgreementInput) {
    const asset = await this.ensureWritableAsset(user, assetId);
    return this.prisma.listingAgreement.create({
      data: {
        assetId,
        ownerId: asset.ownerId,
        transactionType: input.transactionType,
        startDate: new Date(input.startDate),
        endDate: input.endDate ? new Date(input.endDate) : null,
        commissionFormula: input.commissionFormula,
        commissionParams: (input.commissionParams ?? {}) as Prisma.InputJsonValue,
        exclusive: input.exclusive ?? false,
        status: input.status ?? "ACTIVE",
        fileId: input.fileId ?? null,
        note: input.note ?? null,
        createdById: user.id,
      },
    });
  }
}
