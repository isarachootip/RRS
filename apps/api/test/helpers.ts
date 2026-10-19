import "reflect-metadata";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { resetTestDb } from "@rrs/db/testing";
import { AppModule } from "../src/app.module";
import { hashPassword } from "../src/auth/password";
import { PrismaService } from "../src/prisma/prisma.service";
import { setupApp } from "../src/setup-app";

export const PASSWORD = "Correct-horse-42";

/** สร้างแอปจริงต่อกับฐาน rrs_api_test ที่ล้างใหม่ */
export async function createTestApp() {
  const url = process.env.API_TEST_DATABASE_URL;
  if (!url) throw new Error("API_TEST_DATABASE_URL not set");
  await resetTestDb(url);
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = setupApp(mod.createNestApplication());
  await app.init();
  return { app, prisma: app.get(PrismaService) };
}

let roleIds: Record<string, string> | undefined;

export async function createUser(
  app: INestApplication,
  opts: { email: string; role?: "ADMIN" | "MANAGER" | "AGENT" | "ACCOUNTING"; isActive?: boolean },
) {
  const prisma = app.get(PrismaService);
  if (!roleIds) {
    roleIds = {};
    for (const code of ["ADMIN", "MANAGER", "AGENT", "ACCOUNTING"]) {
      const r = await prisma.role.upsert({ where: { code }, update: {}, create: { code, name: code, isSystem: true } });
      roleIds[code] = r.id;
    }
  }
  return prisma.user.create({
    data: {
      email: opts.email,
      fullName: `ทดสอบ ${opts.email}`,
      passwordHash: await hashPassword(PASSWORD),
      isActive: opts.isActive ?? true,
      roles: { create: { roleId: roleIds[opts.role ?? "AGENT"]! } },
    },
  });
}

export function resetRoleCache() {
  roleIds = undefined;
}

/** ดึงค่า cookie rrs_refresh จาก header set-cookie */
export function refreshCookie(setCookie: string[] | string | undefined): string | undefined {
  const list = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const c = list.find((x) => x.startsWith("rrs_refresh="));
  const value = c?.split(";")[0]?.split("=")[1];
  return value || undefined;
}
