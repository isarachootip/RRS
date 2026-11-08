import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildPublicLocation } from "../src/listings/listings-public.helper";
import { resetPublicRateLimitBuckets } from "../src/listings/public-listings.controller";
import type { PrismaService } from "../src/prisma/prisma.service";
import { createTestApp, createUser, resetRoleCache } from "./helpers";
import { loginGetToken } from "./notifications.fixture";

const FORBIDDEN_PUBLIC_KEYS = [
  "minRentPrice",
  "minSalePrice",
  "unitNo",
  "address",
  "owner",
  "ownerId",
  "internalNote",
  "agreements",
  "createdById",
  "updatedById",
  "archivedById",
  "approvedById",
  "deedNo",
];

function collectAllKeys(value: unknown, out = new Set<string>()): Set<string> {
  if (!value || typeof value !== "object") return out;
  if (Array.isArray(value)) {
    for (const item of value) collectAllKeys(item, out);
    return out;
  }
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out.add(k);
    collectAllKeys(v, out);
  }
  return out;
}

describe("P20 Listings workflow & Public API contract test", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let managerToken: string;
  let agentToken: string;
  let houseAssetId: string;
  let listingId: string;
  let listingSlug: string;

  beforeAll(async () => {
    resetRoleCache();
    const ctx = await createTestApp();
    app = ctx.app;
    prisma = ctx.prisma;
    const sfx = Date.now();
    const team = await prisma.team.create({ data: { name: `ทีม P20 ${sfx}` } });
    const managerEmail = `manager.p20.${sfx}@test.local`;
    const agentEmail = `agent.p20.${sfx}@test.local`;
    await createUser(app, { email: managerEmail, role: "MANAGER", teamId: team.id });
    await createUser(app, { email: agentEmail, role: "AGENT", teamId: team.id });
    managerToken = await loginGetToken(app, managerEmail);
    agentToken = await loginGetToken(app, agentEmail);

    const ownerRes = await request(app.getHttpServer())
      .post("/api/v1/owners")
      .set("Authorization", `Bearer ${agentToken}`)
      .send({ fullName: "เจ้าของลับ ห้ามออกเว็บ", phone: `0897${String(sfx).slice(-6)}` })
      .expect(201);

    const assetRes = await request(app.getHttpServer())
      .post("/api/v1/assets")
      .set("Authorization", `Bearer ${agentToken}`)
      .send({
        category: "HOUSE",
        ownershipType: "AGENT",
        ownerId: ownerRes.body.id,
        unitNo: "999/88",
        address: "999/88 ซอยลับเฉพาะ แขวงคลองตัน",
        district: "วัฒนา",
        province: "กรุงเทพมหานคร",
        areaSqm: 185,
        bedrooms: 3,
        bathrooms: 3,
        petAllowed: true,
        rentPrice: 45000,
        minRentPrice: 38000,
        salePrice: 12500000,
        minSalePrice: 11200000,
        internalNote: "ความลับภายในห้ามเปิดเผย รหัสกุญแจ #4455",
        attributes: {
          land: { rai: 0, ngan: 0, sqWah: 52 },
          stories: 2,
          parkingSlots: 2,
        },
      })
      .expect(201);
    houseAssetId = assetRes.body.id;

    await prisma.asset.update({
      where: { id: houseAssetId },
      data: { latitude: 13.736717, longitude: 100.563186 },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("สร้างประกาศ ส่งขออนุมัติ และให้เฉพาะ Manager อนุมัติเผยแพร่ได้", async () => {
    const createRes = await request(app.getHttpServer())
      .post("/api/v1/listings")
      .set("Authorization", `Bearer ${agentToken}`)
      .send({
        assetId: houseAssetId,
        type: "RENT",
        price: 45000,
        titleTh: "บ้านเดี่ยวสุขุมวิท เลี้ยงสัตว์ได้",
        titleEn: "Pet Friendly Sukhumvit Detached House",
        descriptionTh: "บ้านเดี่ยว 2 ชั้น ใกล้ทองหล่อ",
        descriptionEn: "2-storey house near Thonglor",
        submitForApproval: true,
      })
      .expect(201);

    listingId = createRes.body.id;
    listingSlug = createRes.body.slug;
    expect(createRes.body.status).toBe("PENDING_APPROVAL");

    // ยังไม่อนุมัติต้องไม่โผล่ใน Public API
    const beforeApprove = await request(app.getHttpServer()).get(`/api/v1/public/listings/${listingSlug}`).expect(404);
    expect(beforeApprove.body.code).toBe("LISTING_NOT_FOUND");

    // Agent กดอนุมัติเองไม่ได้ (403)
    await request(app.getHttpServer())
      .post(`/api/v1/listings/${listingId}/approve`)
      .set("Authorization", `Bearer ${agentToken}`)
      .expect(403);

    // Manager อนุมัติสำเร็จ -> PUBLISHED
    const approveRes = await request(app.getHttpServer())
      .post(`/api/v1/listings/${listingId}/approve`)
      .set("Authorization", `Bearer ${managerToken}`)
      .expect(200);
    expect(approveRes.body.status).toBe("PUBLISHED");
  });

  it("Contract Test: Public API ไม่มีฟิลด์ต้องห้ามรั่วไหล และปัดพิกัดบ้านเดี่ยวเป็นระดับแขวง", async () => {
    resetPublicRateLimitBuckets();
    const listRes = await request(app.getHttpServer())
      .get("/api/v1/public/listings?type=RENT&petAllowed=true")
      .expect(200);

    expect(listRes.headers["cache-control"]).toContain("public");
    expect(listRes.body.total).toBeGreaterThanOrEqual(1);

    const detailRes = await request(app.getHttpServer()).get(`/api/v1/public/listings/${listingSlug}`).expect(200);

    for (const payload of [listRes.body, detailRes.body]) {
      const keys = collectAllKeys(payload);
      for (const forbidden of FORBIDDEN_PUBLIC_KEYS) {
        expect(keys.has(forbidden)).toBe(false);
      }
      const rawJson = JSON.stringify(payload);
      expect(rawJson).not.toContain("999/88");
      expect(rawJson).not.toContain("ความลับภายในห้ามเปิดเผย");
      expect(rawJson).not.toContain("โฉนด-998877");
      expect(rawJson).not.toContain("เจ้าของลับ");
      expect(rawJson).not.toContain("38000");
    }

    // พิกัดบ้านเดี่ยวปัดเป็นทศนิยม 2 ตำแหน่ง (approximateLocation = true)
    expect(detailRes.body.listing.asset.location).toEqual({
      latitude: 13.74,
      longitude: 100.56,
      approximateLocation: true,
    });
    expect(buildPublicLocation("COMMERCIAL", 13.736717, 100.563186, null, null).approximateLocation).toBe(true);
    expect(buildPublicLocation("FACTORY", 13.736717, 100.563186, null, null).approximateLocation).toBe(true);
    expect(buildPublicLocation("CONDO", 13.736717, 100.563186, null, null).approximateLocation).toBe(false);
    expect(detailRes.body.listing.viewCount).toBe(1);
  });

  it("ปิดประกาศอัตโนมัติเมื่อห้องไม่ว่าง/ถูกจอง และเปลี่ยนกลับเป็น PENDING_APPROVAL เมื่อห้องกลับมาว่าง (D21)", async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/assets/${houseAssetId}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ status: "UNAVAILABLE" })
      .expect(200);

    const closedCheck = await request(app.getHttpServer())
      .get(`/api/v1/listings/${listingId}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .expect(200);
    expect(closedCheck.body.status).toBe("CLOSED");

    await request(app.getHttpServer()).get(`/api/v1/public/listings/${listingSlug}`).expect(404);

    // เมื่อห้องกลับมาว่าง (AVAILABLE) -> D21 เปลี่ยนเป็น PENDING_APPROVAL เพื่อให้ Manager อนุมัติซ้ำ
    await request(app.getHttpServer())
      .patch(`/api/v1/assets/${houseAssetId}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ status: "AVAILABLE" })
      .expect(200);

    const reopenedCheck = await request(app.getHttpServer())
      .get(`/api/v1/listings/${listingId}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .expect(200);
    expect(reopenedCheck.body.status).toBe("PENDING_APPROVAL");

    // Rate limit test บน Public API
    resetPublicRateLimitBuckets();
    await request(app.getHttpServer()).get("/api/v1/public/listings").set("x-rate-limit-max", "1").expect(200);
    await request(app.getHttpServer()).get("/api/v1/public/listings").set("x-rate-limit-max", "1").expect(429);
  });
});
