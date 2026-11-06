import { nextCode } from "@rrs/db";
import type { RequestMeta } from "../common/request-meta";
import type { MailService } from "../mail/mail.service";
import type { NotificationsDispatcherService } from "../notifications/notifications-dispatcher.service";
import type { PrismaService } from "../prisma/prisma.service";

export async function upsertWebsiteLeadRecord(
  prisma: PrismaService,
  notifications: NotificationsDispatcherService,
  mail: MailService,
  agent: { id: string; teamId: string | null },
  normalizedPhone: string,
  listing: {
    id: string;
    slug: string;
    type: "RENT" | "SALE";
    titleTh: string;
    asset: { id: string; code: string; category: string; projectId: string | null; primaryAgentId: string | null };
  },
  input: {
    fullName: string;
    lineId?: string | null;
    email?: string | null;
    noteText?: string | null;
    consentVersion?: string;
    consentText?: string;
  },
  meta: RequestMeta,
) {
  const now = new Date();
  const version = input.consentVersion || "1.0";
  const consentFormatted = `[v${version}:WEBSITE] ${input.consentText || "ยินยอมให้ติดต่อกลับและประมวลผลตาม PDPA"}`;
  const existing = await prisma.lead.findFirst({
    where: { phone: normalizedPhone, archivedAt: null },
    select: { id: true, code: true, sourceListingId: true },
  });

  let leadId = existing?.id ?? "";
  let leadCode = existing?.code ?? "";
  const isExistingLead = Boolean(existing);

  if (existing) {
    await prisma.lead.update({
      where: { id: existing.id },
      data: {
        lastActivityAt: now,
        consentAt: now,
        consentText: consentFormatted,
        ...(existing.sourceListingId ? {} : { sourceListingId: listing.id }),
      },
    });
  } else {
    leadCode = await nextCode(prisma, "LD", "LD-");
    const created = await prisma.lead.create({
      data: {
        code: leadCode,
        intent: listing.type === "SALE" ? "BUY" : "RENT",
        fullName: input.fullName,
        phone: normalizedPhone,
        lineId: input.lineId ?? null,
        email: input.email ?? null,
        source: "WEBSITE",
        sourceListingId: listing.id,
        preferredProjectId: listing.asset.projectId,
        preferredCategory: listing.asset.category as never,
        specialNote: input.noteText ?? null,
        ownerAgentId: agent.id,
        status: "NEW",
        consentAt: now,
        consentText: consentFormatted,
        lastActivityAt: now,
        createdById: agent.id,
        updatedById: agent.id,
      },
    });
    leadId = created.id;
  }

  await prisma.activity.create({
    data: {
      type: "NOTE",
      leadId,
      body: `[เว็บไซต์ประกาศ ${listing.asset.code}] ${input.noteText || "ลูกค้าติดต่อผ่านหน้าเว็บประกาศ"}`,
      createdById: agent.id,
    },
  });
  await prisma.auditLog.create({
    data: {
      actorId: agent.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
      entityType: "pdpa_consent",
      entityId: leadId,
      action: "CREATE",
      after: { subjectType: "LEAD", version, channel: "WEBSITE", consentedAt: now.toISOString() },
    },
  });
  await notifications.dispatchEvent({
    event: "lead.created",
    title: `ลูกค้าจากเว็บประกาศ: ${input.fullName} (${leadCode})`,
    body: `สนใจประกาศ ${listing.titleTh} (${listing.asset.code})`,
    link: `/leads?id=${leadId}`,
    dedupeBaseKey: `portal.lead:${leadId}:${now.getTime()}`,
    context: { teamId: agent.teamId, assetAgentId: agent.id, explicitUserIds: [agent.id] },
    overrideRecipients: ["TEAM_MANAGER", "ASSET_AGENT", "EXPLICIT"],
  });
  if (input.email) {
    await mail.send({
      to: input.email,
      subject: `[RRS] ยืนยันการรับข้อมูลสอบถามประกาศ ${listing.titleTh}`,
      text: `เรียนคุณ ${input.fullName}\nทีมงาน RRS ได้รับข้อความของท่านสำหรับประกาศ ${listing.titleTh} (${listing.asset.code}) เรียบร้อยแล้ว`,
    });
  }
  return { leadId, leadCode, isExistingLead, agent };
}
