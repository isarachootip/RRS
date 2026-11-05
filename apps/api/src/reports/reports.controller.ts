import { Controller, Get, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import type { AuthUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/public.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { Can } from "../rbac/can.decorator";
import { ReportsService } from "./reports.service";
import { ReportFilterQuerySchema, type ReportFilterQueryDto } from "./reports.types";

@Controller("reports")
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get("dashboard")
  @Can("dashboard.read")
  getDashboard(
    @CurrentUser() user: AuthUser,
    @Query(new ZodPipe(ReportFilterQuerySchema)) query: ReportFilterQueryDto,
  ) {
    return this.reportsService.getDashboard(user, query);
  }

  @Get("summary")
  @Can("report.read")
  getSummary(@CurrentUser() user: AuthUser, @Query(new ZodPipe(ReportFilterQuerySchema)) query: ReportFilterQueryDto) {
    return this.reportsService.getSummary(user, query);
  }

  @Get("filter-options")
  @Can("dashboard.read", "report.read")
  getFilterOptions(@CurrentUser() user: AuthUser) {
    return this.reportsService.getFilterOptions(user);
  }

  @Get("export")
  @Can("report.export")
  async exportReport(
    @CurrentUser() user: AuthUser,
    @Query(new ZodPipe(ReportFilterQuerySchema)) query: ReportFilterQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { file, contentType, filename } = await this.reportsService.exportReport(user, query);
    res.set({
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
    });
    return file;
  }
}
