import type { Prisma } from "@rrs/db";
import { fromSatang, toSatang, type Scope } from "@rrs/shared";
import type { AuthUser } from "../auth/auth.types";

const to2Dec = (v: Prisma.Decimal | string | number) => fromSatang(toSatang(v));

export const COMMISSION_INCLUDE = {
  asset: {
    select: {
      id: true,
      code: true,
      unitNo: true,
      category: true,
      ownershipType: true,
      primaryAgentId: true,
      primaryAgent: { select: { id: true, fullName: true, isFreelance: true } },
      agents: { include: { user: { select: { id: true, fullName: true, isFreelance: true } } } },
      agreements: {
        where: { archivedAt: null, status: "ACTIVE" as const },
        orderBy: { createdAt: "desc" as const },
        take: 1,
      },
    },
  },
  contract: {
    select: {
      id: true,
      contractNo: true,
      monthlyRent: true,
      startDate: true,
      endDate: true,
      lead: {
        select: {
          id: true,
          code: true,
          fullName: true,
          ownerAgentId: true,
          ownerAgent: { select: { id: true, fullName: true, isFreelance: true } },
        },
      },
    },
  },
  saleDeal: {
    select: {
      id: true,
      code: true,
      agreedPrice: true,
      agentId: true,
      agent: { select: { id: true, fullName: true, isFreelance: true } },
      lead: {
        select: {
          id: true,
          code: true,
          fullName: true,
          ownerAgentId: true,
          ownerAgent: { select: { id: true, fullName: true, isFreelance: true } },
        },
      },
    },
  },
  approvedBy: { select: { id: true, fullName: true } },
  splits: {
    include: {
      user: { select: { id: true, fullName: true, isFreelance: true } },
      payout: { select: { id: true, periodLabel: true, status: true, paidAt: true } },
    },
    orderBy: [{ revision: "asc" as const }, { createdAt: "asc" as const }],
  },
  revisions: {
    include: { approvedBy: { select: { id: true, fullName: true } } },
    orderBy: { revision: "asc" as const },
  },
  payments: {
    where: { archivedAt: null },
    orderBy: { paidAt: "desc" as const },
  },
} satisfies Prisma.CommissionInclude;

export type CommissionWithInclude = Prisma.CommissionGetPayload<{ include: typeof COMMISSION_INCLUDE }>;

export function buildSuggestedSplits(com: CommissionWithInclude) {
  const leadOwnerId = com.contract?.lead.ownerAgentId ?? com.saleDeal?.lead.ownerAgentId ?? null;
  const listingAgentId =
    com.asset.agents.find((a) => a.role === "LISTING")?.userId ?? com.asset.primaryAgentId ?? leadOwnerId;
  const closerAgentId = com.saleDeal?.agentId ?? leadOwnerId;

  return [
    { role: "FINDER" as const, userId: leadOwnerId, shareType: "PERCENT" as const, sharePercent: "30.00" },
    { role: "LISTING" as const, userId: listingAgentId, shareType: "PERCENT" as const, sharePercent: "20.00" },
    { role: "CLOSER" as const, userId: closerAgentId, shareType: "PERCENT" as const, sharePercent: "30.00" },
    { role: "COMPANY" as const, userId: null, shareType: "PERCENT" as const, sharePercent: "20.00" },
  ];
}

export function buildCommissionScopeWhere(scope: Scope, user: AuthUser): Prisma.CommissionWhereInput {
  if (scope === "ALL") return {};
  if (scope === "TEAM") {
    const teamId = user.teamId ?? "__none__";
    return {
      OR: [{ splits: { some: { user: { teamId } } } }, { asset: { primaryAgent: { teamId } } }],
    };
  }
  return { splits: { some: { userId: user.id } } };
}

export function formatCommissionResponse(com: CommissionWithInclude, user: AuthUser, scope: Scope) {
  const formattedSplits = com.splits.map((s) => ({
    ...s,
    sharePercent: s.sharePercent !== null ? to2Dec(s.sharePercent) : null,
    amount: to2Dec(s.amount),
    withholdingTax: to2Dec(s.withholdingTax),
    netAmount: to2Dec(s.netAmount),
  }));
  const visibleSplits = scope === "OWN" ? formattedSplits.filter((s) => s.userId === user.id) : formattedSplits;
  const currentSplits = visibleSplits.filter((s) => s.revision === com.currentRevision);
  return {
    ...com,
    baseAmount: to2Dec(com.baseAmount),
    totalAmount: to2Dec(com.totalAmount),
    splits: visibleSplits,
    currentSplits,
    suggestedSplits: buildSuggestedSplits(com),
  };
}
