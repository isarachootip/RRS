import { Injectable } from "@nestjs/common";
import type { AuditAction, Prisma } from "@rrs/db";
import type { RequestMeta } from "../common/request-meta";
import { PrismaService } from "../prisma/prisma.service";
import { getAuditContext } from "./request-context";

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

/**
 * เขียนและค้นหา audit_logs (append-only)
 * การสร้าง/แก้/archive บนตารางธุรกิจจะถูกบันทึกอัตโนมัติผ่าน Prisma Client Extension (prisma-audit.extension.ts)
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntry, db: Db = this.prisma) {
    const ctx = getAuditContext();
    await db.auditLog.create({
      data: {
        actorId: entry.actorId ?? ctx?.actorId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        before: (entry.before ?? undefined) as Prisma.InputJsonValue | undefined,
        after: (entry.after ?? undefined) as Prisma.InputJsonValue | undefined,
        ip: entry.meta?.ip ?? ctx?.ip,
        userAgent: entry.meta?.userAgent ?? ctx?.userAgent,
      },
    });
  }

  async listByEntity(entityType: string, entityId?: string, limit = 50) {
    const rows = await this.prisma.auditLog.findMany({
      where: {
        entityType,
        ...(entityId ? { entityId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(limit, 1), 200),
    });

    const actorIds = Array.from(new Set(rows.map((r) => r.actorId).filter((id): id is string => Boolean(id))));
    const users = actorIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, fullName: true, email: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u.fullName]));

    return {
      items: rows.map((r) => ({
        id: r.id.toString(),
        actorId: r.actorId,
        actorName: r.actorId ? (userMap.get(r.actorId) ?? "ผู้ใช้ในระบบ") : null,
        ip: r.ip,
        entityType: r.entityType,
        entityId: r.entityId,
        action: r.action,
        before: r.before,
        after: r.after,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }
}
