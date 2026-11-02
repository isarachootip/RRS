import { randomBytes } from "node:crypto";
import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@rrs/db";
import type { AuthUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { DataScopeService } from "../rbac/data-scope.service";
import { redactAssetForUser, type AssetWithRelations } from "../rbac/field-redaction";
import {
  resolveMatchCriteria,
  scoreAssetMatch,
  type CreateLeadOffersInput,
  type MatchQueryInput,
} from "./matching.types";

const SHARE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class MatchingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataScope: DataScopeService,
  ) {}

  private async ensureAccessibleLead(user: AuthUser, leadId: string) {
    const leadScope = this.dataScope.where(user, "leads") as Prisma.LeadWhereInput;
    const lead = await this.prisma.lead.findFirst({ where: { AND: [leadScope, { id: leadId }] } });
    if (!lead) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "ไม่พบข้อมูลลูกค้า" });
    }
    return lead;
  }

  async findMatchesForLead(user: AuthUser, leadId: string, overrides: MatchQueryInput) {
    const lead = await this.ensureAccessibleLead(user, leadId);
    const criteria = resolveMatchCriteria(lead, overrides);

    const assetWhere: Prisma.AssetWhereInput = {
      archivedAt: null,
      status: { in: ["AVAILABLE", "VIEWING_SCHEDULED"] },
      ...(criteria.intent === "BUY" ? { forSale: true } : { forRent: true }),
      ...(criteria.petRequired ? { petAllowed: true } : {}),
    };

    const candidates = await this.prisma.asset.findMany({
      where: assetWhere,
      take: 100,
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
        media: { orderBy: { sortOrder: "asc" }, take: 3 },
        appointmentItems: {
          where: { appointment: { status: { in: ["PENDING", "CONFIRMED"] } } },
          select: { appointmentId: true },
        },
      },
    });

    const items = candidates
      .map((asset) => {
        const { matchScore, matchedReasons } = scoreAssetMatch(asset, criteria);
        const redacted = redactAssetForUser(user, asset as unknown as AssetWithRelations, {
          isList: true,
        });
        return {
          ...redacted,
          matchScore,
          matchedReasons,
          hasViewingScheduled: asset.status === "VIEWING_SCHEDULED" || asset.appointmentItems.length > 0,
        };
      })
      .sort((a, b) => b.matchScore - a.matchScore);

    return { criteria, items };
  }

  async listOffersForLead(user: AuthUser, leadId: string) {
    await this.ensureAccessibleLead(user, leadId);
    const items = await this.prisma.leadOffer.findMany({
      where: { leadId },
      orderBy: { createdAt: "desc" },
      include: {
        asset: {
          select: {
            id: true,
            code: true,
            category: true,
            unitNo: true,
            rentPrice: true,
            salePrice: true,
            project: { select: { id: true, name: true } },
          },
        },
      },
    });
    return { items };
  }

  async createOffersForLead(user: AuthUser, leadId: string, input: CreateLeadOffersInput) {
    await this.ensureAccessibleLead(user, leadId);
    const batchToken = randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + SHARE_TTL_MS);

    const offers = await this.prisma.$transaction(
      input.items.map((item, idx) => {
        const rowToken = idx === 0 ? batchToken : `${batchToken}:${idx}`;
        const data = {
          offeredById: user.id,
          offeredPrice: item.offeredPrice ?? null,
          note: item.note ?? null,
          shareToken: rowToken,
          shareExpiresAt: expiresAt,
        };
        return this.prisma.leadOffer.upsert({
          where: { leadId_assetId: { leadId, assetId: item.assetId } },
          create: { leadId, assetId: item.assetId, ...data },
          update: data,
        });
      }),
    );

    return { shareToken: batchToken, shareExpiresAt: expiresAt.toISOString(), offers };
  }

  async getPublicOffersByToken(token: string) {
    const baseToken = token.split(":")[0]?.trim();
    if (!baseToken) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "ลิงก์ไม่ถูกต้องหรือหมดอายุแล้ว" });
    }

    const offers = await this.prisma.leadOffer.findMany({
      where: {
        OR: [{ shareToken: baseToken }, { shareToken: { startsWith: `${baseToken}:` } }],
        shareExpiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "asc" },
      include: {
        asset: {
          include: {
            project: { select: { name: true, district: true, province: true } },
            media: { orderBy: { sortOrder: "asc" } },
          },
        },
      },
    });

    if (offers.length === 0) {
      throw new NotFoundException({ code: "NOT_FOUND", message: "ลิงก์ไม่ถูกต้องหรือหมดอายุแล้ว" });
    }

    return {
      shareToken: baseToken,
      expiresAt: offers[0]!.shareExpiresAt?.toISOString() ?? null,
      items: offers.map((o) => ({
        offerId: o.id,
        id: o.asset.id,
        code: o.asset.code,
        category: o.asset.category,
        projectName: o.asset.project?.name ?? null,
        district: o.asset.district ?? o.asset.project?.district ?? null,
        province: o.asset.province ?? o.asset.project?.province ?? null,
        floor: o.asset.floor,
        areaSqm: o.asset.areaSqm ? Number(o.asset.areaSqm) : null,
        roomType: o.asset.roomType,
        bedrooms: o.asset.bedrooms,
        bathrooms: o.asset.bathrooms,
        furniture: o.asset.furniture,
        appliances: o.asset.appliances,
        petAllowed: o.asset.petAllowed,
        rentPrice: o.asset.rentPrice ? Number(o.asset.rentPrice) : null,
        salePrice: o.asset.salePrice ? Number(o.asset.salePrice) : null,
        offeredPrice: o.offeredPrice ? Number(o.offeredPrice) : null,
        note: o.note,
        media: o.asset.media.map((m) => ({
          id: m.id,
          fileId: m.fileId,
          caption: m.caption,
          isCover: m.isCover,
        })),
      })),
    };
  }
}
