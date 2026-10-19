import { execSync } from "node:child_process";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

/**
 * สำหรับเทสต์เท่านั้น: สร้างฐาน (ถ้ายังไม่มี) ล้าง schema แล้วรัน migration ทั้งหมด
 * ป้องกันการล้างฐานผิด: ชื่อฐานต้องลงท้ายด้วย _test
 * แต่ละแพ็กเกจใช้ฐานของตัวเอง (เช่น rrs_test, rrs_api_test) เพื่อรันเทสต์พร้อมกันได้
 */
export async function resetTestDb(url: string): Promise<void> {
  const u = new URL(url);
  const dbName = u.pathname.replace(/^\//, "");
  if (!dbName.endsWith("_test")) throw new Error(`ปฏิเสธการล้างฐาน "${dbName}": ชื่อฐานทดสอบต้องลงท้ายด้วย _test`);

  const adminUrl = new URL(url);
  adminUrl.pathname = "/postgres";
  const admin = new PrismaClient({ datasourceUrl: adminUrl.toString() });
  try {
    const exists = await admin.$queryRaw<unknown[]>`SELECT 1 FROM pg_database WHERE datname = ${dbName}`;
    if (exists.length === 0) await admin.$executeRawUnsafe(`CREATE DATABASE "${dbName.replace(/"/g, "")}"`);
  } finally {
    await admin.$disconnect();
  }

  const db = new PrismaClient({ datasourceUrl: url });
  try {
    await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "public" CASCADE`);
    await db.$executeRawUnsafe(`CREATE SCHEMA "public"`);
  } finally {
    await db.$disconnect();
  }

  const pkgDir = path.resolve(__dirname, "..");
  execSync("pnpm exec prisma migrate deploy", {
    cwd: pkgDir,
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: url },
  });
}

/** เปลี่ยนชื่อฐานใน URL เช่น rrs_test → rrs_api_test */
export function testDbUrl(base: string, name: string): string {
  const u = new URL(base);
  u.pathname = `/${name}`;
  return u.toString();
}
