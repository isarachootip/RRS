import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { DEFAULT_ROLE_PERMISSIONS, assetAttributesSchemas, normalizePhone, type AssetCategory } from "@rrs/shared";
import { seed } from "../src/seed";
import { resetTestDb } from "./reset";

const prisma = new PrismaClient();

beforeAll(async () => {
  await resetTestDb();
  await seed(prisma);
});
afterAll(() => prisma.$disconnect());

describe("seed", () => {
  it("สร้างข้อมูลครบตามที่ P01 กำหนด", async () => {
    expect(await prisma.role.count()).toBe(4);
    for (const code of ["ADMIN", "MANAGER", "AGENT", "ACCOUNTING"]) {
      expect(await prisma.userRole.count({ where: { role: { code } } })).toBe(2);
    }
    expect(await prisma.team.count()).toBe(2);
    expect(await prisma.asset.count()).toBe(30);
    expect(await prisma.lead.count()).toBe(50);
    expect(await prisma.owner.count({ where: { isCompany: true } })).toBe(1);
    expect(await prisma.notificationRule.count()).toBeGreaterThanOrEqual(10);
  });

  it("สิทธิ์ในฐานข้อมูลตรงกับค่าเริ่มต้นใน @rrs/shared", async () => {
    for (const [role, perms] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      const rows = await prisma.rolePermission.findMany({
        where: { role: { code: role } },
        include: { permission: true },
      });
      expect(Object.fromEntries(rows.map((r) => [r.permission.code, r.scope]))).toEqual(perms);
    }
  });

  it("มีสินทรัพย์หลายประเภท ทั้ง OWNER และ AGENT และ attributes ผ่าน schema ของประเภทนั้น", async () => {
    const assets = await prisma.asset.findMany();
    expect(new Set(assets.map((a) => a.category)).size).toBeGreaterThanOrEqual(7);
    expect(assets.some((a) => a.ownershipType === "OWNER")).toBe(true);
    expect(assets.some((a) => a.ownershipType === "AGENT")).toBe(true);
    for (const a of assets) {
      expect(() => assetAttributesSchemas[a.category as AssetCategory].parse(a.attributes)).not.toThrow();
    }
    const units = assets.filter((a) => a.category === "APARTMENT_UNIT");
    expect(units.every((u) => u.buildingId)).toBe(true);
  });

  it("ห้อง AGENT ทุกห้องมีสัญญาฝากเช่า/ฝากขาย, ห้อง OWNER เป็นของบริษัท", async () => {
    const agentAssets = await prisma.asset.findMany({
      where: { ownershipType: "AGENT" },
      include: { agreements: true },
    });
    expect(agentAssets.every((a) => a.agreements.length === 1)).toBe(true);
    const ownerAssets = await prisma.asset.findMany({ where: { ownershipType: "OWNER" }, include: { owner: true } });
    expect(ownerAssets.every((a) => a.owner.isCompany)).toBe(true);
  });

  it("เบอร์โทรทุกรายการเป็น E.164 และมี lead เบอร์ซ้ำ 1 คู่สำหรับทดสอบการตรวจซ้ำ", async () => {
    const leads = await prisma.lead.findMany({ select: { phone: true } });
    expect(leads.every((l) => l.phone && normalizePhone(l.phone) === l.phone)).toBe(true);
    const dup = await prisma.lead.groupBy({ by: ["phone"], _count: true, having: { phone: { _count: { gt: 1 } } } });
    expect(dup.length).toBeGreaterThanOrEqual(1);
  });

  it("ทุก lead มีประวัติการมอบหมายเจ้าของ", async () => {
    expect(await prisma.lead.count({ where: { assignments: { none: {} } } })).toBe(0);
  });

  it("รันซ้ำได้โดยไม่สร้างข้อมูลซ้ำ", async () => {
    await seed(prisma);
    expect(await prisma.asset.count()).toBe(30);
    expect(await prisma.lead.count()).toBe(50);
  });
});
