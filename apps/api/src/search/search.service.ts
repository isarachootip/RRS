import { Injectable } from "@nestjs/common";
import type { Prisma } from "@rrs/db";
import { maskPhone } from "@rrs/shared";
import type { AuthUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { DataScopeService } from "../rbac/data-scope.service";
import {
  redactAssetForUser,
  redactLeadInList,
  type AssetWithRelations,
  type LeadWithRelations,
} from "../rbac/field-redaction";

function buildPhoneSearchPatterns(q: string): string[] {
  const digits = q.replace(/\D/g, "");
  if (digits.length < 3) return [];
  const patterns = new Set<string>([digits]);
  if (digits.startsWith("0") && digits.length >= 2) {
    patterns.add(digits.slice(1));
    patterns.add(`+66${digits.slice(1)}`);
  }
  return Array.from(patterns);
}

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataScope: DataScopeService,
  ) {}

  async search(user: AuthUser, rawQuery: string, limit = 10) {
    const startedAt = Date.now();
    const q = rawQuery.trim();
    if (!q) {
      return { owners: [], assets: [], leads: [], tookMs: 0 };
    }

    const safeLimit = Math.min(25, Math.max(1, limit));
    const phonePatterns = buildPhoneSearchPatterns(q);

    const [owners, assets, leads] = await Promise.all([
      this.searchOwners(user, q, phonePatterns, safeLimit),
      this.searchAssets(user, q, safeLimit),
      this.searchLeads(user, q, phonePatterns, safeLimit),
    ]);

    return {
      owners,
      assets,
      leads,
      tookMs: Date.now() - startedAt,
    };
  }

  private async searchOwners(user: AuthUser, q: string, phonePatterns: string[], limit: number) {
    if (!user.permissions?.["owner.read"]) return [];
    const scopeWhere = this.dataScope.where(user, "owners") as Prisma.OwnerWhereInput;
    const orFilters: Prisma.OwnerWhereInput[] = [
      { code: { contains: q, mode: "insensitive" } },
      { fullName: { contains: q, mode: "insensitive" } },
      ...phonePatterns.map((p) => ({ phone: { contains: p } })),
    ];

    const rows = await this.prisma.owner.findMany({
      where: { AND: [scopeWhere, { OR: orFilters }] },
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        code: true,
        fullName: true,
        phone: true,
        status: true,
      },
    });

    return rows.map((r) => ({
      ...r,
      phone: maskPhone(r.phone),
    }));
  }

  private async searchAssets(user: AuthUser, q: string, limit: number) {
    if (!user.permissions?.["asset.read"]) return [];
    const scopeWhere = this.dataScope.where(user, "assets") as Prisma.AssetWhereInput;
    const orFilters: Prisma.AssetWhereInput[] = [
      { code: { contains: q, mode: "insensitive" } },
      { unitNo: { contains: q, mode: "insensitive" } },
      { district: { contains: q, mode: "insensitive" } },
      { project: { name: { contains: q, mode: "insensitive" } } },
      { project: { nameEn: { contains: q, mode: "insensitive" } } },
    ];

    const rows = await this.prisma.asset.findMany({
      where: { AND: [scopeWhere, { OR: orFilters }] },
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        project: { select: { id: true, name: true, district: true } },
        primaryAgent: { select: { id: true, fullName: true, teamId: true } },
        agents: { include: { user: { select: { id: true, fullName: true, teamId: true } } } },
        owner: {
          select: {
            id: true,
            code: true,
            fullName: true,
            phone: true,
            lineId: true,
            email: true,
            agentId: true,
            agent: { select: { teamId: true } },
          },
        },
      },
    });

    return rows.map((r) => redactAssetForUser(user, r as unknown as AssetWithRelations, { isList: true }));
  }

  private async searchLeads(user: AuthUser, q: string, phonePatterns: string[], limit: number) {
    if (!user.permissions?.["lead.read"]) return [];
    const scopeWhere = this.dataScope.where(user, "leads") as Prisma.LeadWhereInput;
    const orFilters: Prisma.LeadWhereInput[] = [
      { code: { contains: q, mode: "insensitive" } },
      { fullName: { contains: q, mode: "insensitive" } },
      { preferredLocation: { contains: q, mode: "insensitive" } },
      ...phonePatterns.map((p) => ({ phone: { contains: p } })),
    ];

    const rows = await this.prisma.lead.findMany({
      where: { AND: [scopeWhere, { OR: orFilters }] },
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        ownerAgent: { select: { id: true, fullName: true, teamId: true } },
        collaborators: {
          include: { user: { select: { id: true, fullName: true, teamId: true } } },
        },
      },
    });

    return rows.map((r) => redactLeadInList(user, r as unknown as LeadWithRelations));
  }
}
