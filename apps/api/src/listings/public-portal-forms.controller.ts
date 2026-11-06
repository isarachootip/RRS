import { Body, Controller, HttpCode, Post, Req } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { Public } from "../auth/public.decorator";
import { requestMeta } from "../common/request-meta";
import { ZodPipe } from "../common/zod.pipe";
import { enforcePublicRateLimit } from "./public-listings.controller";
import { PublicPortalFormsService } from "./public-portal-forms.service";
import {
  type PublicClickEventInput,
  type PublicInquiryInput,
  type PublicOwnerSubmissionInput,
  type PublicViewingRequestInput,
  publicClickEventSchema,
  publicInquirySchema,
  publicOwnerSubmissionSchema,
  publicViewingRequestSchema,
} from "./public-portal-forms.types";

const FORM_MAX_REQ_PER_MIN = 20;

@ApiTags("public-portal-forms")
@Public()
@Controller("public")
export class PublicPortalFormsController {
  constructor(private readonly forms: PublicPortalFormsService) {}

  @Post("inquiries")
  @ApiOperation({ summary: "ส่งฟอร์มสอบถามข้อมูลประกาศจากเว็บสาธารณะ → สร้าง/ผูก Lead ใน CRM" })
  submitInquiry(@Req() req: Request, @Body(new ZodPipe(publicInquirySchema)) body: PublicInquiryInput) {
    const meta = requestMeta(req);
    const customMax = req.headers["x-rate-limit-max"] ? Number(req.headers["x-rate-limit-max"]) : FORM_MAX_REQ_PER_MIN;
    enforcePublicRateLimit(`public-inquiry:${meta.ip ?? "unknown"}`, customMax);
    return this.forms.submitInquiry(body, meta);
  }

  @Post("viewing-requests")
  @ApiOperation({ summary: "ส่งฟอร์มขอนัดดูห้องจากเว็บสาธารณะ → สร้าง/ผูก Lead + Appointment สถานะ PENDING" })
  submitViewingRequest(
    @Req() req: Request,
    @Body(new ZodPipe(publicViewingRequestSchema)) body: PublicViewingRequestInput,
  ) {
    const meta = requestMeta(req);
    const customMax = req.headers["x-rate-limit-max"] ? Number(req.headers["x-rate-limit-max"]) : FORM_MAX_REQ_PER_MIN;
    enforcePublicRateLimit(`public-viewing:${meta.ip ?? "unknown"}`, customMax);
    return this.forms.submitViewingRequest(body, meta);
  }

  @Post("owner-submissions")
  @ApiOperation({ summary: "ส่งฟอร์มฝากขาย/ฝากเช่าจากเว็บสาธารณะ → สร้าง Owner สถานะ NEW (D22)" })
  submitOwnerProperty(
    @Req() req: Request,
    @Body(new ZodPipe(publicOwnerSubmissionSchema)) body: PublicOwnerSubmissionInput,
  ) {
    const meta = requestMeta(req);
    const customMax = req.headers["x-rate-limit-max"] ? Number(req.headers["x-rate-limit-max"]) : FORM_MAX_REQ_PER_MIN;
    enforcePublicRateLimit(`public-owner-sub:${meta.ip ?? "unknown"}`, customMax);
    return this.forms.submitOwnerProperty(body, meta);
  }

  @Post("click-events")
  @HttpCode(200)
  @ApiOperation({ summary: "บันทึกการกดปุ่ม LINE หรือโทรจากหน้าประกาศพร้อม UTM/รหัสประกาศ" })
  logClickEvent(@Req() req: Request, @Body(new ZodPipe(publicClickEventSchema)) body: PublicClickEventInput) {
    const meta = requestMeta(req);
    return this.forms.logClickEvent(body, meta);
  }
}
