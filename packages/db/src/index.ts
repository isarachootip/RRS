import { type Prisma, PrismaClient } from "@prisma/client";

export * from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/** Prisma client ตัวเดียวทั้งโปรเซส (กัน connection รั่วตอน hot reload) */
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * ออกเลขรันแบบ atomic เช่น nextCode(db, "OW", "OW-") → "OW-000001"
 * ใช้ key แยกปีได้ เช่น nextCode(db, "LS-2026", "LS-2026-", 4) → "LS-2026-0001"
 */
export async function nextCode(db: Db, key: string, prefix: string, width = 6): Promise<string> {
  const rows = await db.$queryRaw<{ value: number }[]>`
    INSERT INTO "code_sequences" ("key", "value") VALUES (${key}, 1)
    ON CONFLICT ("key") DO UPDATE SET "value" = "code_sequences"."value" + 1
    RETURNING "value"`;
  const value = rows[0]?.value;
  if (value === undefined) throw new Error(`nextCode failed for ${key}`);
  return `${prefix}${String(value).padStart(width, "0")}`;
}

/** true ถ้า error มาจากการจอง/ทำสัญญาทับช่วงเวลา (EXCLUDE หรือ trigger ข้ามตาราง) */
export function isPeriodOverlapError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /bookings_no_overlap|contracts_no_overlap|asset_period_overlap/.test(msg);
}

/** true ถ้า error มาจากการพยายามแก้สัญญาที่ล็อกแล้ว */
export function isContractLockedError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.includes("contract_locked");
}

export * from "./importer/importer.types";
export * from "./importer/legacy-importer";
