import { nextCode } from "@rrs/db";
import type { RequestMeta } from "../common/request-meta";
import type { MailService } from "../mail/mail.service";
import type { NotificationsDispatcherService } from "../notifications/notifications-dispatcher.service";
import type { PrismaService } from "../prisma/prisma.service";
import {
  type PublicClickEventInput,
  type PublicOwnerSubmissionInput,
  validatePublicFormSecurity,
} from "./public-portal-forms.types";

export async function handlePublicOwnerSubmission(
  prisma: PrismaService,
  notifications: NotificationsDispatcherService,
  mail: MailService,
  agent: { id: string; teamId: string | null },
  normalizedPhone: string,
  input: PublicOwnerSubmissionInput,
  meta: RequestMeta,
) {
  validatePublicFormSecurity(input);
  const now = new Date();
  const ownerCode = await nextCode(prisma, "OW", "OW-");
  const version = input.consentVersion || "1.0";
  const detailLines = [
    `ฝาก${input.transactionType === "RENT" ? "เช่า" : "ขาย"} (${input.category})`,
    input.projectName ? `โครงการ: ${input.projectName}` : null,
    input.locationText ? `ทำเล: ${input.locationText}` : null,
    input.expectedPrice ? `ราคาที่ต้องการ: ${input.expectedPrice.toLocaleString()} บาท` : null,
    input.areaSqm ? `ขนาด: ${input.areaSqm} ตร.ม.` : null,
    input.bedrooms !== undefined && input.bedrooms !== null ? `ห้องนอน: ${input.bedrooms}` : null,
    input.photoUrls?.length ? `รูปภาพแนบ: ${input.photoUrls.join(", ")}` : null,
    input.note ? `หมายเหตุ: ${input.note}` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  const owner = await prisma.owner.create({
    data: {
      code: ownerCode,
      fullName: input.fullName,
      phone: normalizedPhone,
      lineId: input.lineId ?? null,
      email: input.email ?? null,
      sourceChannel: "WEBSITE",
      firstContactAt: now,
      agentId: agent.id,
      status: "NEW",
      note: detailLines,
      createdById: agent.id,
      updatedById: agent.id,
    },
  });

  await prisma.activity.create({
    data: {
      type: "NOTE",
      ownerId: owner.id,
      body: `[ฝากทรัพย์ผ่านเว็บ] ${detailLines}`,
      createdById: agent.id,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: agent.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
      entityType: "pdpa_consent",
      entityId: owner.id,
      action: "CREATE",
      after: { subjectType: "OWNER", version, channel: "WEBSITE", consentedAt: now.toISOString() },
    },
  });

  await notifications.dispatchEvent({
    event: "lead.created",
    title: `เจ้าของทรัพย์ฝากขาย/เช่าใหม่: ${input.fullName} (${ownerCode})`,
    body: detailLines,
    link: `/owners?id=${owner.id}`,
    dedupeBaseKey: `portal.owner:${owner.id}`,
    context: { teamId: agent.teamId, explicitUserIds: [agent.id] },
    overrideRecipients: ["TEAM_MANAGER", "EXPLICIT"],
  });

  if (input.email) {
    await mail.send({
      to: input.email,
      subject: `[RRS] ยืนยันการรับข้อมูลฝากขาย/ฝากเช่า (${ownerCode})`,
      text: `เรียนคุณ ${input.fullName}\nทีมงาน RRS ได้รับข้อมูลฝากทรัพย์ของท่านเรียบร้อยแล้ว และจะติดต่อกลับเพื่อตรวจสอบรายละเอียดและลงประกาศให้โดยเร็วที่สุด`,
    });
  }

  return { ownerId: owner.id, ownerCode: owner.code, status: owner.status, consentRecorded: true };
}

export async function handlePublicClickEvent(prisma: PrismaService, input: PublicClickEventInput, meta: RequestMeta) {
  const listing = await prisma.listing.findUnique({
    where: { id: input.listingId },
    select: { id: true, slug: true, asset: { select: { code: true } } },
  });
  await prisma.auditLog.create({
    data: {
      ip: meta.ip,
      userAgent: meta.userAgent,
      entityType: "PortalClickEvent",
      entityId: input.listingId,
      action: "CREATE",
      after: {
        channel: input.channel,
        assetCode: listing?.asset.code ?? null,
        utmSource: input.utmSource ?? "portal",
        utmMedium: input.utmMedium ?? input.channel.toLowerCase(),
        utmCampaign: input.utmCampaign ?? listing?.slug ?? null,
      },
    },
  });
  const refCode = listing?.asset.code ?? input.listingId;
  const targetUrl =
    input.channel === "LINE" ? `https://line.me/R/ti/p/@rrs?ref=${encodeURIComponent(refCode)}` : "tel:+6620000000";
  return { recorded: true, channel: input.channel, refCode, targetUrl };
}
