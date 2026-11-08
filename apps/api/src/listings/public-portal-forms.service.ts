import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { nextCode } from "@rrs/db";
import { normalizePhone } from "@rrs/shared";
import { AssetStatusService } from "../assets/asset-status.service";
import type { RequestMeta } from "../common/request-meta";
import { MailService } from "../mail/mail.service";
import { LineMessagingService } from "../notifications/line-messaging.service";
import { NotificationsDispatcherService } from "../notifications/notifications-dispatcher.service";
import { PrismaService } from "../prisma/prisma.service";
import { upsertWebsiteLeadRecord } from "./public-lead-upsert.helper";
import { handlePublicClickEvent, handlePublicOwnerSubmission } from "./public-owner-submission.helper";
import {
  type PublicClickEventInput,
  type PublicInquiryInput,
  type PublicOwnerSubmissionInput,
  type PublicViewingRequestInput,
  validatePublicFormSecurity,
} from "./public-portal-forms.types";

@Injectable()
export class PublicPortalFormsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsDispatcherService,
    private readonly mail: MailService,
    private readonly assetStatus: AssetStatusService,
    private readonly line: LineMessagingService,
  ) {}

  private parseNormalizedPhone(raw: string): string {
    try {
      const normalized = normalizePhone(raw);
      if (!normalized) throw new Error("empty phone");
      return normalized;
    } catch {
      throw new BadRequestException({ code: "INVALID_PHONE", message: "รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง" });
    }
  }

  private async resolveDefaultAgentId(preferredId?: string | null): Promise<{ id: string; teamId: string | null }> {
    if (preferredId) {
      const u = await this.prisma.user.findUnique({ where: { id: preferredId }, select: { id: true, teamId: true } });
      if (u) return u;
    }
    const fallback = await this.prisma.user.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
      select: { id: true, teamId: true },
    });
    if (!fallback) throw new BadRequestException({ code: "NO_ACTIVE_AGENT", message: "ไม่พบผู้รับผิดชอบในระบบ" });
    return fallback;
  }

  async submitInquiry(input: PublicInquiryInput, meta: RequestMeta) {
    validatePublicFormSecurity(input);
    const listing = await this.prisma.listing.findFirst({
      where: { id: input.listingId, archivedAt: null },
      select: {
        id: true,
        slug: true,
        type: true,
        titleTh: true,
        asset: { select: { id: true, code: true, category: true, projectId: true, primaryAgentId: true } },
      },
    });
    if (!listing) throw new NotFoundException({ code: "LISTING_NOT_FOUND", message: "ไม่พบประกาศที่ระบุ" });
    const phone = this.parseNormalizedPhone(input.phone);
    const agent = await this.resolveDefaultAgentId(listing.asset.primaryAgentId);
    const res = await upsertWebsiteLeadRecord(
      this.prisma,
      this.notifications,
      this.mail,
      agent,
      phone,
      listing,
      { ...input, noteText: input.message },
      meta,
    );
    if (process.env.NODE_ENV !== "test") {
      void this.line.sendToAdmin(
        `📩 [ลูกค้าสอบถามจากเว็บ]\nรหัสลูกค้า: ${res.leadCode}\nชื่อ: ${input.fullName} (${phone})\nทรัพย์: ${listing.asset.code} — ${listing.titleTh}\nข้อความ: ${input.message || "-"}`,
      );
    }
    return { leadId: res.leadId, leadCode: res.leadCode, isExistingLead: res.isExistingLead, consentRecorded: true };
  }

  async submitViewingRequest(input: PublicViewingRequestInput, meta: RequestMeta) {
    validatePublicFormSecurity(input);
    const listing = await this.prisma.listing.findFirst({
      where: { id: input.listingId, archivedAt: null },
      select: {
        id: true,
        slug: true,
        type: true,
        titleTh: true,
        assetId: true,
        asset: { select: { id: true, code: true, category: true, projectId: true, primaryAgentId: true } },
      },
    });
    if (!listing) throw new NotFoundException({ code: "LISTING_NOT_FOUND", message: "ไม่พบประกาศที่ระบุ" });
    const startsAt = new Date(input.preferredStartAt);
    const endsAt = input.preferredEndAt
      ? new Date(input.preferredEndAt)
      : new Date(startsAt.getTime() + 60 * 60 * 1000);
    const phone = this.parseNormalizedPhone(input.phone);
    const agent = await this.resolveDefaultAgentId(listing.asset.primaryAgentId);
    const leadRes = await upsertWebsiteLeadRecord(
      this.prisma,
      this.notifications,
      this.mail,
      agent,
      phone,
      listing,
      { ...input, noteText: `ขอนัดชมห้องวันที่ ${startsAt.toISOString()} ${input.note ?? ""}`.trim() },
      meta,
    );
    const apptCode = await nextCode(this.prisma, "AP", "AP-");
    const appointment = await this.prisma.appointment.create({
      data: {
        code: apptCode,
        leadId: leadRes.leadId,
        agentId: agent.id,
        startsAt,
        endsAt,
        status: "PENDING",
        note: input.note ?? `ขอนัดดูจากหน้าเว็บประกาศ ${listing.titleTh}`,
        createdById: agent.id,
        updatedById: agent.id,
        items: { create: [{ assetId: listing.assetId, sortOrder: 0 }] },
      },
    });
    await this.assetStatus.recompute(listing.assetId, agent.id);
    if (process.env.NODE_ENV !== "test") {
      void this.line.sendToAdmin(
        `📅 [ขอนัดดูทรัพย์จากเว็บ]\nรหัสนัด: ${appointment.code}\nลูกค้า: ${input.fullName} (${phone})\nทรัพย์: ${listing.asset.code} — ${listing.titleTh}\nเวลานัด: ${startsAt.toLocaleString("th-TH")}`,
      );
    }
    return {
      leadId: leadRes.leadId,
      leadCode: leadRes.leadCode,
      isExistingLead: leadRes.isExistingLead,
      appointmentId: appointment.id,
      appointmentCode: appointment.code,
      appointmentStatus: appointment.status,
    };
  }

  async submitOwnerProperty(input: PublicOwnerSubmissionInput, meta: RequestMeta) {
    const phone = this.parseNormalizedPhone(input.phone);
    const agent = await this.resolveDefaultAgentId();
    const res = await handlePublicOwnerSubmission(this.prisma, this.notifications, this.mail, agent, phone, input, meta);
    if (process.env.NODE_ENV !== "test") {
      void this.line.sendToAdmin(
        `🏠 [เจ้าของฝากทรัพย์ใหม่จากเว็บ]\nรหัสเจ้าของ: ${res.ownerCode}\nชื่อ: ${input.fullName} (${phone})`,
      );
    }
    return res;
  }

  async logClickEvent(input: PublicClickEventInput, meta: RequestMeta) {
    const res = await handlePublicClickEvent(this.prisma, input, meta);
    if (process.env.NODE_ENV !== "test" && input.channel === "LINE") {
      void this.line.sendToAdmin(
        `💬 [ลูกค้ากดปุ่มทัก LINE จากหน้าเว็บ]\nสนใจทรัพย์รหัส: ${input.utmCampaign ?? input.listingId}`,
      );
    }
    return res;
  }
}
