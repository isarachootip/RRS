import type { Prisma } from "@rrs/db";
import { fromSatang, toSatang, type PermissionCode } from "@rrs/shared";
import type { AuthUser } from "../auth/auth.types";
import type { PrismaService } from "../prisma/prisma.service";
import type { DataScopeService } from "../rbac/data-scope.service";
import { extractCommissionSatang } from "./reports-aggregation.helper";
import {
  ALL_ASSET_STATUSES,
  parseReportDateBounds,
  type NormalizedDealRow,
  type ReportFilterQueryDto,
  type SharedReportDataset,
} from "./reports.types";

export async function loadSharedReportDataset(
  prisma: PrismaService,
  dataScope: DataScopeService,
  user: AuthUser,
  query: ReportFilterQueryDto,
  permission: PermissionCode = "report.read",
): Promise<SharedReportDataset> {
  const scope = dataScope.scopeFor(user, permission);
  const effTeamId = scope === "TEAM" ? (user.teamId ?? "__none__") : query.teamId;
  const effAgentId = scope === "OWN" ? user.id : query.agentId;
  const dateRange = parseReportDateBounds(query.startDate, query.endDate);

  const assetWhere: Prisma.AssetWhereInput = {
    archivedAt: null,
    ...(query.projectId ? { projectId: query.projectId } : {}),
    ...(query.category ? { category: query.category } : {}),
    ...(query.ownerId ? { ownerId: query.ownerId } : {}),
    ...(query.dealType === "RENT" ? { forRent: true } : query.dealType === "SALE" ? { forSale: true } : {}),
    ...(effTeamId ? { primaryAgent: { teamId: effTeamId } } : {}),
    ...(effAgentId ? { primaryAgentId: effAgentId } : {}),
  };

  const [assets, newLeads, viewings, bookingsCount, contracts, saleDeals, expenses] = await Promise.all([
    prisma.asset.findMany({ where: assetWhere, select: { id: true, status: true } }),
    prisma.lead.count({
      where: {
        archivedAt: null,
        ...(dateRange ? { createdAt: dateRange } : {}),
        ...(query.dealType === "RENT" ? { intent: "RENT" } : query.dealType === "SALE" ? { intent: "BUY" } : {}),
        ...(effTeamId ? { ownerAgent: { teamId: effTeamId } } : {}),
        ...(effAgentId ? { ownerAgentId: effAgentId } : {}),
      },
    }),
    prisma.appointment.count({
      where: {
        status: { not: "CANCELLED" },
        ...(dateRange ? { startsAt: dateRange } : {}),
        ...(effTeamId ? { agent: { teamId: effTeamId } } : {}),
        ...(effAgentId ? { agentId: effAgentId } : {}),
      },
    }),
    prisma.booking.count({ where: { ...(dateRange ? { createdAt: dateRange } : {}), asset: assetWhere } }),
    query.dealType === "SALE"
      ? Promise.resolve([])
      : prisma.contract.findMany({
          where: {
            status: { in: ["ACTIVE", "ENDED", "TERMINATED"] },
            ...(dateRange ? { startDate: dateRange } : {}),
            asset: assetWhere,
          },
          include: {
            asset: { include: { project: true, primaryAgent: true } },
            lead: { include: { ownerAgent: true } },
            payments: { where: { archivedAt: null } },
            rentSchedules: true,
            commission: { include: { splits: { include: { payout: true } } } },
          },
          orderBy: { startDate: "asc" },
        }),
    query.dealType === "RENT"
      ? Promise.resolve([])
      : prisma.saleDeal.findMany({
          where: { stage: "CLOSED", ...(dateRange ? { updatedAt: dateRange } : {}), asset: assetWhere },
          include: {
            asset: { include: { project: true, primaryAgent: true } },
            agent: true,
            payments: { where: { archivedAt: null } },
            commission: { include: { splits: { include: { payout: true } } } },
          },
          orderBy: { updatedAt: "asc" },
        }),
    prisma.expense.findMany({
      where: { archivedAt: null, ...(dateRange ? { incurredAt: dateRange } : {}), asset: assetWhere },
    }),
  ]);

  const assetsByStatus: Record<string, number> = Object.fromEntries(ALL_ASSET_STATUSES.map((s) => [s, 0]));
  for (const a of assets) assetsByStatus[a.status] = (assetsByStatus[a.status] ?? 0) + 1;

  const expensesByAsset = new Map<string, bigint>();
  for (const e of expenses) {
    expensesByAsset.set(e.assetId, (expensesByAsset.get(e.assetId) ?? 0n) + toSatang(e.amount));
  }
  const expAssigned = new Set<string>();
  const rows: NormalizedDealRow[] = [];

  for (const c of contracts) {
    const isOwner = c.asset.ownershipType === "OWNER";
    let ownerRevenueSatang = 0n;
    let ownerCommissionPaidSatang = 0n;
    for (const p of c.payments) {
      const amt = toSatang(p.amount);
      if (
        isOwner &&
        p.direction === "IN" &&
        ["MONTHLY_RENT", "ADVANCE_RENT", "OTHER_INCOME", "BOOKING_FEE"].includes(p.type)
      ) {
        ownerRevenueSatang += amt;
      } else if (isOwner && p.direction === "OUT" && p.type !== "REFUND") {
        ownerCommissionPaidSatang += amt;
      }
    }
    const ownerExpenseSatang = isOwner && !expAssigned.has(c.assetId) ? (expensesByAsset.get(c.assetId) ?? 0n) : 0n;
    if (isOwner) expAssigned.add(c.assetId);

    let receivableSatang = 0n;
    for (const rs of isOwner ? c.rentSchedules : []) {
      if (["DUE", "PARTIAL", "OVERDUE"].includes(rs.status)) {
        const diff = toSatang(rs.amountDue) - toSatang(rs.amountPaid);
        if (diff > 0n) receivableSatang += diff;
      }
    }

    const cm = extractCommissionSatang(c.commission, c.asset.ownershipType, scope === "OWN" ? user.id : null);
    const ownerNetIncomeSatang = ownerRevenueSatang - ownerExpenseSatang - ownerCommissionPaidSatang;
    const ag = c.lead.ownerAgent ?? c.asset.primaryAgent;

    rows.push({
      id: c.id,
      dealCode: c.contractNo,
      dealType: "RENT",
      date: c.startDate,
      assetId: c.assetId,
      assetCode: c.asset.code,
      ownershipType: c.asset.ownershipType,
      projectId: c.asset.projectId,
      projectName: c.asset.project?.name ?? "ไม่ระบุโครงการ",
      agentId: ag?.id ?? null,
      agentName: ag?.fullName ?? "ไม่ระบุผู้ดูแล",
      teamId: ag?.teamId ?? null,
      ownerRevenueSatang,
      ownerExpenseSatang,
      ownerCommissionPaidSatang,
      ownerNetIncomeSatang,
      totalCommissionSatang: cm.totalCommissionSatang,
      agentShareSatang: cm.agentShareSatang,
      companyCommissionShareSatang: cm.companyShareSatang,
      companyNetIncomeSatang: ownerNetIncomeSatang + cm.companyShareSatang,
      receivableSatang: receivableSatang + cm.receivableSatang,
      payableSatang: cm.payableSatang,
    });
  }

  for (const d of saleDeals) {
    const cm = extractCommissionSatang(d.commission, d.asset.ownershipType, scope === "OWN" ? user.id : null);
    rows.push({
      id: d.id,
      dealCode: d.code,
      dealType: "SALE",
      date: d.transferDate ?? d.updatedAt,
      assetId: d.assetId,
      assetCode: d.asset.code,
      ownershipType: d.asset.ownershipType,
      projectId: d.asset.projectId,
      projectName: d.asset.project?.name ?? "ไม่ระบุโครงการ",
      agentId: d.agent.id,
      agentName: d.agent.fullName,
      teamId: d.agent.teamId,
      ownerRevenueSatang: 0n,
      ownerExpenseSatang: 0n,
      ownerCommissionPaidSatang: 0n,
      ownerNetIncomeSatang: 0n,
      totalCommissionSatang: cm.totalCommissionSatang,
      agentShareSatang: cm.agentShareSatang,
      companyCommissionShareSatang: cm.companyShareSatang,
      companyNetIncomeSatang: cm.companyShareSatang,
      receivableSatang: cm.receivableSatang,
      payableSatang: cm.payableSatang,
    });
  }

  const closedDeals = contracts.length + saleDeals.length;
  const convBps = newLeads > 0 ? (BigInt(closedDeals) * 10000n) / BigInt(newLeads) : 0n;
  return {
    assetsByStatus,
    totalAssets: assets.length,
    funnel: {
      newLeads,
      viewings,
      bookingsAndOffers: bookingsCount + saleDeals.length,
      closedDeals,
      conversionRatePercent: fromSatang(convBps),
    },
    rows,
  };
}
