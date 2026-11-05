import { Body, Controller, Get, Param, Patch, Post, Query, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import type { AuthUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/public.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { Can } from "../rbac/can.decorator";
import { PdpaService } from "./pdpa.service";
import {
  AnonymizePdpaSubjectSchema,
  ExportPdpaQuerySchema,
  LogViewSensitiveSchema,
  PdpaSubjectTypeSchema,
  RecordConsentSchema,
  RectifyPdpaSubjectSchema,
  RunRetentionCleanupSchema,
  SearchPdpaSubjectsQuerySchema,
  type AnonymizePdpaSubjectInput,
  type ExportPdpaQuery,
  type LogViewSensitiveInput,
  type PdpaSubjectType,
  type RecordConsentInput,
  type RectifyPdpaSubjectInput,
  type RunRetentionCleanupInput,
  type SearchPdpaSubjectsQuery,
} from "./pdpa.types";

@Controller("pdpa")
export class PdpaController {
  constructor(private readonly pdpaService: PdpaService) {}

  private extractMeta(req: Request) {
    return {
      ip: req.ip ?? req.socket?.remoteAddress,
      userAgent: req.headers["user-agent"],
    };
  }

  @Post("consents")
  recordConsent(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(RecordConsentSchema)) dto: RecordConsentInput,
    @Req() req: Request,
  ) {
    return this.pdpaService.recordConsent(user.id, dto, this.extractMeta(req));
  }

  @Post("view-sensitive")
  logViewSensitive(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(LogViewSensitiveSchema)) dto: LogViewSensitiveInput,
    @Req() req: Request,
  ) {
    return this.pdpaService.logViewSensitive(user.id, dto, this.extractMeta(req));
  }

  @Get("subjects")
  @Can("user.manage")
  searchSubjects(@Query(new ZodPipe(SearchPdpaSubjectsQuerySchema)) query: SearchPdpaSubjectsQuery) {
    return this.pdpaService.searchSubjects(query);
  }

  @Get("subjects/:type/:id/export")
  @Can("user.manage")
  async exportSubject(
    @CurrentUser() user: AuthUser,
    @Param("type", new ZodPipe(PdpaSubjectTypeSchema)) type: PdpaSubjectType,
    @Param("id") id: string,
    @Query(new ZodPipe(ExportPdpaQuerySchema)) query: ExportPdpaQuery,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const format = query.format ?? "json";
    const result = await this.pdpaService.exportSubjectData(user.id, type, id, format, this.extractMeta(req));
    if (format === "pdf" && result.pdfBuffer) {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="pdpa-${type.toLowerCase()}-${id}.pdf"`);
      res.status(200).send(result.pdfBuffer);
      return;
    }
    res.status(200).json(result.payload);
  }

  @Patch("subjects/:type/:id")
  @Can("user.manage")
  rectifySubject(
    @CurrentUser() user: AuthUser,
    @Param("type", new ZodPipe(PdpaSubjectTypeSchema)) type: PdpaSubjectType,
    @Param("id") id: string,
    @Body(new ZodPipe(RectifyPdpaSubjectSchema)) dto: RectifyPdpaSubjectInput,
    @Req() req: Request,
  ) {
    return this.pdpaService.rectifySubjectData(user.id, type, id, dto, this.extractMeta(req));
  }

  @Post("subjects/:type/:id/anonymize")
  @Can("user.manage")
  anonymizeSubject(
    @CurrentUser() user: AuthUser,
    @Param("type", new ZodPipe(PdpaSubjectTypeSchema)) type: PdpaSubjectType,
    @Param("id") id: string,
    @Body(new ZodPipe(AnonymizePdpaSubjectSchema)) dto: AnonymizePdpaSubjectInput,
    @Req() req: Request,
  ) {
    return this.pdpaService.anonymizeSubject(user.id, type, id, dto.reason, this.extractMeta(req));
  }

  @Post("jobs/retention-cleanup")
  @Can("user.manage")
  runRetentionCleanup(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(RunRetentionCleanupSchema)) dto: RunRetentionCleanupInput,
    @Req() req: Request,
  ) {
    return this.pdpaService.runRetentionCleanup(user.id, dto, this.extractMeta(req));
  }
}
