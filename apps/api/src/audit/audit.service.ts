import { Injectable } from "@nestjs/common";
import type { AuditAction, Prisma } from "@rrs/db";
import type { RequestMeta } from "../common/request-meta";
import { PrismaService } from "../prisma/prisma.service";

export interface AuditEntry {
  actorId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  meta?: RequestMeta;
}

type Db = PrismaService | Prisma.TransactionClient;

/** เขียน audit_logs (append-only) — P05 จะเพิ่มการบันทึกอัตโนมัติทุก mutation */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntry, db: Db = this.prisma) {
    await db.auditLog.create({
      data: {
        actorId: entry.actorId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        before: (entry.before ?? undefined) as Prisma.InputJsonValue | undefined,
        after: (entry.after ?? undefined) as Prisma.InputJsonValue | undefined,
        ip: entry.meta?.ip,
        userAgent: entry.meta?.userAgent,
      },
    });
  }
}
