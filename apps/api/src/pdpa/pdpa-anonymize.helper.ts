import { NotFoundException } from "@nestjs/common";
import type { PrismaService } from "../prisma/prisma.service";
import {
  ANONYMIZED_NAME,
  DEFAULT_RETENTION_MONTHS,
  type PdpaSubjectType,
  type RunRetentionCleanupInput,
} from "./pdpa.types";

export interface PdpaRequestMeta {
  ip?: string;
  userAgent?: string;
}

function scrubText(text: string, tokens: Array<string | null | undefined>): string {
  let result = text;
  for (const token of tokens) {
    if (!token || token.trim().length < 2) continue;
    result = result.split(token).join("[PDPA-REDACTED]");
  }
  return result;
}

export async function anonymizeSubjectRecord(
  prisma: PrismaService,
  actorId: string,
  subjectType: PdpaSubjectType,
  id: string,
  reason: string,
  meta: PdpaRequestMeta,
) {
  const now = new Date();

  if (subjectType === "LEAD") {
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: { contracts: { select: { id: true } }, activities: { select: { id: true, body: true } } },
    });
    if (!lead) {
      throw new NotFoundException({ code: "LEAD_NOT_FOUND", message: "ไม่พบข้อมูลลูกค้าที่ต้องการลบข้อมูลส่วนบุคคล" });
    }

    const tokens = [lead.fullName, lead.phone, lead.lineId, lead.email];
    const contractIds = lead.contracts.map((c) => c.id);

    await prisma.lead.update({
      where: { id },
      data: {
        fullName: ANONYMIZED_NAME,
        phone: null,
        lineId: null,
        email: null,
        specialNote: null,
        consentText: null,
        updatedById: actorId,
        archivedAt: now,
        archivedById: actorId,
      },
    });

    if (contractIds.length > 0) {
      await prisma.contractParty.updateMany({
        where: { contractId: { in: contractIds } },
        data: {
          fullName: ANONYMIZED_NAME,
          phone: null,
          email: null,
          idNumber: null,
        },
      });
    }

    for (const act of lead.activities) {
      const scrubbed = scrubText(act.body, tokens);
      if (scrubbed !== act.body) {
        await prisma.activity.update({ where: { id: act.id }, data: { body: scrubbed } });
      }
    }
  } else {
    const owner = await prisma.owner.findUnique({ where: { id } });
    if (!owner) {
      throw new NotFoundException({
        code: "OWNER_NOT_FOUND",
        message: "ไม่พบข้อมูลเจ้าของทรัพย์ที่ต้องการลบข้อมูลส่วนบุคคล",
      });
    }

    const tokens = [owner.fullName, owner.phone, owner.lineId, owner.email];
    await prisma.owner.update({
      where: { id },
      data: {
        fullName: ANONYMIZED_NAME,
        phone: null,
        lineId: null,
        email: null,
        note: null,
        updatedById: actorId,
        archivedAt: now,
        archivedById: actorId,
      },
    });

    const ownerActivities = await prisma.activity.findMany({
      where: { ownerId: id },
      select: { id: true, body: true },
    });
    for (const act of ownerActivities) {
      const scrubbed = scrubText(act.body, tokens);
      if (scrubbed !== act.body) {
        await prisma.activity.update({ where: { id: act.id }, data: { body: scrubbed } });
      }
    }
  }

  await prisma.auditLog.create({
    data: {
      actorId,
      ip: meta.ip,
      userAgent: meta.userAgent,
      entityType: "pdpa_anonymize",
      entityId: id,
      action: "ARCHIVE",
      before: { anonymized: false },
      after: { anonymized: true, subjectType, reason, anonymizedAt: now.toISOString() },
    },
  });

  return {
    id,
    subjectType,
    fullName: ANONYMIZED_NAME,
    anonymizedAt: now.toISOString(),
  };
}

export async function executeRetentionCleanup(
  prisma: PrismaService,
  actorId: string,
  input: RunRetentionCleanupInput,
  meta: PdpaRequestMeta,
) {
  const retentionMonths = input.retentionMonths ?? DEFAULT_RETENTION_MONTHS;
  const now = input.nowIso ? new Date(input.nowIso) : new Date();
  const cutoffDate = new Date(now);
  cutoffDate.setUTCMonth(cutoffDate.getUTCMonth() - retentionMonths);

  const candidates = await prisma.lead.findMany({
    where: {
      status: { in: ["LOST", "CANCELLED"] },
      fullName: { not: ANONYMIZED_NAME },
      OR: [{ lastActivityAt: { lte: cutoffDate } }, { lastActivityAt: null, updatedAt: { lte: cutoffDate } }],
    },
    select: { id: true },
  });

  const anonymizedLeadIds: string[] = [];
  for (const candidate of candidates) {
    await anonymizeSubjectRecord(
      prisma,
      actorId,
      "LEAD",
      candidate.id,
      `PDPA Auto-Retention Cleanup (ครบกำหนด ${retentionMonths} เดือน)`,
      meta,
    );
    anonymizedLeadIds.push(candidate.id);
  }

  return {
    retentionMonths,
    cutoffDate: cutoffDate.toISOString(),
    anonymizedCount: anonymizedLeadIds.length,
    anonymizedLeadIds,
  };
}
