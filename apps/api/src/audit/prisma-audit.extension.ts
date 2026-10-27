import { type AuditAction, Prisma, type PrismaClient } from "@rrs/db";
import { getAuditContext } from "./request-context";

/** ตารางที่บันทึก audit อัตโนมัติผ่าน Prisma Client Extension */
const AUDITED_MODELS = new Set([
  "Owner",
  "Project",
  "Building",
  "Asset",
  "ListingAgreement",
  "Listing",
  "Lead",
  "Appointment",
  "Booking",
  "Contract",
  "SaleDeal",
  "Payment",
  "RentSchedule",
  "Expense",
  "Commission",
  "CommissionRevision",
  "CommissionPayout",
  "File",
]);

const REDACTED_KEYS = new Set(["passwordHash", "totpSecret", "tokenHash"]);
const JSON_COLUMNS = new Set(["attributes", "commissionParams", "notificationPrefs", "timing"]);

function toEntityType(model: string): string {
  return model.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
}

function toDelegateName(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

function sanitizeSnapshot(row: unknown): Record<string, unknown> | null {
  if (!row || typeof row !== "object") return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
    if (REDACTED_KEYS.has(k)) continue;
    if (v instanceof Date) out[k] = v.toISOString();
    else if (typeof v === "bigint") out[k] = v.toString();
    else if (v !== null && typeof v === "object" && "toFixed" in v && typeof v.toFixed === "function") {
      out[k] = (v as { toFixed: (d: number) => string }).toFixed(2);
    } else if (JSON_COLUMNS.has(k) || v === undefined || typeof v !== "object" || Array.isArray(v) || v === null) {
      out[k] = v;
    }
  }
  return out;
}

function detectUpdateAction(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): AuditAction {
  if (!before || !after) return "UPDATE";
  if (!before.archivedAt && after.archivedAt) return "ARCHIVE";
  if (before.archivedAt && !after.archivedAt) return "RESTORE";
  if (!before.approvedAt && after.approvedAt) return "APPROVE";
  if (before.status !== undefined && after.status !== undefined && before.status !== after.status) {
    return "UPDATE";
  }
  return "UPDATE";
}

export function createAuditExtension(basePrisma: PrismaClient) {
  return Prisma.defineExtension({
    name: "rrs-auto-audit",
    query: {
      $allModels: {
        async create({ model, args, query }) {
          const result = await query(args);
          if (model && AUDITED_MODELS.has(model)) {
            const after = sanitizeSnapshot(result);
            const entityId = after?.id ? String(after.id) : null;
            const ctx = getAuditContext();
            const fallbackActor =
              (after?.createdById as string | undefined) ?? (after?.uploadedById as string | undefined) ?? null;
            await basePrisma.auditLog.create({
              data: {
                actorId: ctx?.actorId ?? fallbackActor,
                ip: ctx?.ip,
                userAgent: ctx?.userAgent,
                entityType: toEntityType(model),
                entityId,
                action: "CREATE",
                after: (after ?? undefined) as Prisma.InputJsonValue | undefined,
              },
            });
          }
          return result;
        },

        async update({ model, args, query }) {
          if (!model || !AUDITED_MODELS.has(model)) {
            return query(args);
          }
          const delegate = (basePrisma as unknown as Record<string, { findUnique: (a: unknown) => Promise<unknown> }>)[
            toDelegateName(model)
          ];
          const rawBefore = delegate ? await delegate.findUnique({ where: args.where }) : null;
          const before = sanitizeSnapshot(rawBefore);

          const result = await query(args);
          const after = sanitizeSnapshot(result);
          const entityId = (after?.id ?? before?.id) ? String(after?.id ?? before?.id) : null;
          const ctx = getAuditContext();
          const fallbackActor =
            (after?.updatedById as string | undefined) ?? (after?.archivedById as string | undefined) ?? null;

          await basePrisma.auditLog.create({
            data: {
              actorId: ctx?.actorId ?? fallbackActor,
              ip: ctx?.ip,
              userAgent: ctx?.userAgent,
              entityType: toEntityType(model),
              entityId,
              action: detectUpdateAction(before, after),
              before: (before ?? undefined) as Prisma.InputJsonValue | undefined,
              after: (after ?? undefined) as Prisma.InputJsonValue | undefined,
            },
          });
          return result;
        },
      },
    },
  });
}
