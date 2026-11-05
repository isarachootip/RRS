import { Injectable, NotFoundException } from "@nestjs/common";
import { normalizePhone } from "@rrs/shared";
import { PrismaService } from "../prisma/prisma.service";
import { type PdpaRequestMeta, anonymizeSubjectRecord, executeRetentionCleanup } from "./pdpa-anonymize.helper";
import { buildPdpaPdfBuffer, loadPdpaExportPayload, searchPdpaSubjects } from "./pdpa-export.helper";
import type {
  LogViewSensitiveInput,
  PdpaExportPayload,
  PdpaSubjectItem,
  PdpaSubjectType,
  RecordConsentInput,
  RectifyPdpaSubjectInput,
  RunRetentionCleanupInput,
  SearchPdpaSubjectsQuery,
} from "./pdpa.types";

@Injectable()
export class PdpaService {
  constructor(private readonly prisma: PrismaService) {}

  async recordConsent(actorId: string, input: RecordConsentInput, meta: PdpaRequestMeta) {
    const consentedAt = new Date();
    const formattedConsentText = `[v${input.version}:${input.channel}] ${input.consentText}`;

    if (input.subjectType === "LEAD") {
      const lead = await this.prisma.lead.findUnique({ where: { id: input.subjectId } });
      if (!lead) {
        throw new NotFoundException({ code: "LEAD_NOT_FOUND", message: "ไม่พบข้อมูลลูกค้าสำหรับบันทึกความยินยอม" });
      }
      await this.prisma.lead.update({
        where: { id: input.subjectId },
        data: { consentAt: consentedAt, consentText: formattedConsentText, updatedById: actorId },
      });
    } else {
      const owner = await this.prisma.owner.findUnique({ where: { id: input.subjectId } });
      if (!owner) {
        throw new NotFoundException({ code: "OWNER_NOT_FOUND", message: "ไม่พบข้อมูลเจ้าของทรัพย์" });
      }
      await this.prisma.owner.update({ where: { id: input.subjectId }, data: { updatedById: actorId } });
    }

    await this.prisma.auditLog.create({
      data: {
        actorId,
        ip: meta.ip,
        userAgent: meta.userAgent,
        entityType: "pdpa_consent",
        entityId: input.subjectId,
        action: "CREATE",
        after: {
          subjectType: input.subjectType,
          version: input.version,
          channel: input.channel,
          consentedAt: consentedAt.toISOString(),
        },
      },
    });

    return {
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      version: input.version,
      channel: input.channel,
      consentedAt: consentedAt.toISOString(),
    };
  }

  async searchSubjects(query: SearchPdpaSubjectsQuery): Promise<{ items: PdpaSubjectItem[] }> {
    return searchPdpaSubjects(this.prisma, query);
  }

  async exportSubjectData(
    actorId: string,
    subjectType: PdpaSubjectType,
    id: string,
    format: "json" | "pdf",
    meta: PdpaRequestMeta,
  ): Promise<{ payload: PdpaExportPayload; pdfBuffer?: Buffer }> {
    const payload = await loadPdpaExportPayload(this.prisma, subjectType, id);
    await this.prisma.auditLog.create({
      data: {
        actorId,
        ip: meta.ip,
        userAgent: meta.userAgent,
        entityType: "pdpa_dsr",
        entityId: id,
        action: "EXPORT",
        after: { subjectType, format },
      },
    });
    return { payload, pdfBuffer: format === "pdf" ? buildPdpaPdfBuffer(payload) : undefined };
  }

  async rectifySubjectData(
    actorId: string,
    subjectType: PdpaSubjectType,
    id: string,
    input: RectifyPdpaSubjectInput,
    meta: PdpaRequestMeta,
  ) {
    const normalizedPhone = input.phone === undefined ? undefined : input.phone ? normalizePhone(input.phone) : null;
    const data = {
      ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
      ...(normalizedPhone !== undefined ? { phone: normalizedPhone } : {}),
      ...(input.lineId !== undefined ? { lineId: input.lineId } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      updatedById: actorId,
    };
    const updated =
      subjectType === "LEAD"
        ? await this.prisma.lead.update({ where: { id }, data })
        : await this.prisma.owner.update({ where: { id }, data });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        ip: meta.ip,
        userAgent: meta.userAgent,
        entityType: "pdpa_rectify",
        entityId: id,
        action: "UPDATE",
        after: { subjectType, updatedFields: Object.keys(input) },
      },
    });
    return { id: updated.id, subjectType, fullName: updated.fullName, phone: updated.phone, email: updated.email };
  }

  async anonymizeSubject(actorId: string, type: PdpaSubjectType, id: string, reason: string, meta: PdpaRequestMeta) {
    return anonymizeSubjectRecord(this.prisma, actorId, type, id, reason, meta);
  }

  async logViewSensitive(actorId: string, input: LogViewSensitiveInput, meta: PdpaRequestMeta) {
    const entry = await this.prisma.auditLog.create({
      data: {
        actorId,
        ip: meta.ip,
        userAgent: meta.userAgent,
        entityType: input.entityType,
        entityId: input.entityId,
        action: "VIEW_SENSITIVE",
        after: { field: input.field },
      },
    });
    return { id: entry.id.toString(), action: entry.action, entityType: entry.entityType, entityId: entry.entityId };
  }

  async runRetentionCleanup(actorId: string, input: RunRetentionCleanupInput, meta: PdpaRequestMeta) {
    return executeRetentionCleanup(this.prisma, actorId, input, meta);
  }
}
