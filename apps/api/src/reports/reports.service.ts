import { Injectable } from "@nestjs/common";
import { AuditService } from "../audit/audit.service";
import type { AuthUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { DataScopeService } from "../rbac/data-scope.service";
import { buildDashboardFromDataset, buildReportSummaryFromDataset } from "./reports-aggregation.helper";
import { loadSharedReportDataset } from "./reports-dataset.helper";
import { buildReportExportStream } from "./reports-export.helper";
import type { ReportFilterQueryDto } from "./reports.types";

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataScope: DataScopeService,
    private readonly audit: AuditService,
  ) {}

  async getDashboard(user: AuthUser, query: ReportFilterQueryDto) {
    const dataset = await loadSharedReportDataset(this.prisma, this.dataScope, user, query, "dashboard.read");
    return buildDashboardFromDataset(dataset);
  }

  async getSummary(user: AuthUser, query: ReportFilterQueryDto) {
    const dataset = await loadSharedReportDataset(this.prisma, this.dataScope, user, query, "report.read");
    return buildReportSummaryFromDataset(dataset, query);
  }

  async exportReport(user: AuthUser, query: ReportFilterQueryDto) {
    const dataset = await loadSharedReportDataset(this.prisma, this.dataScope, user, query, "report.export");
    const summary = buildReportSummaryFromDataset(dataset, query);
    const exported = buildReportExportStream(summary, query.format);

    await this.audit.log({
      action: "EXPORT",
      entityType: "Report",
      actorId: user.id,
      after: {
        format: query.format,
        groupBy: query.groupBy,
        granularity: query.granularity,
        startDate: query.startDate ?? null,
        endDate: query.endDate ?? null,
        teamId: query.teamId ?? null,
        projectId: query.projectId ?? null,
        dealType: query.dealType,
        rowsCount: summary.buckets.length,
      },
    });

    return exported;
  }

  async getFilterOptions(user: AuthUser) {
    const isTeamScoped =
      user.permissions?.["dashboard.read"] === "TEAM" || user.permissions?.["report.read"] === "TEAM";
    const [teams, projects] = await Promise.all([
      this.prisma.team.findMany({
        where: isTeamScoped && user.teamId ? { id: user.teamId } : {},
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      this.prisma.project.findMany({
        where: { archivedAt: null },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);
    return { teams, projects };
  }
}
