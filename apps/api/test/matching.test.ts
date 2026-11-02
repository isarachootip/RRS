import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaService } from "../src/prisma/prisma.service";
import { PASSWORD, createTestApp, createUser, resetRoleCache } from "./helpers";

describe("P09 · จับคู่ห้อง (Matching), บันทึกห้องที่เสนอ (LeadOffer), และลิงก์แชร์ลูกค้า 7 วัน", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let agentToken: string;
  let agentId: string;
  let leadId: string;
  let bestAssetId: string;
  let partialAssetId: string;
  let thirdAssetId: string;
  let unavailableAssetId: string;

  beforeAll(async () => {
    resetRoleCache();
    ({ app, prisma } = await createTestApp());
    const sfx = Date.now();
    const email = `agent.p09.${sfx}@test.local`;

    const team = await prisma.team.create({ data: { name: `ทีม P09 ${sfx}` } });
    const agent = await createUser(app, { email, role: "AGENT", teamId: team.id });
    agentId = agent.id;

    const loginRes = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email, password: PASSWORD })
      .expect(200);
    agentToken = loginRes.body.accessToken;

    const owner = await prisma.owner.create({
      data: { code: `OW-${sfx}`, fullName: "เจ้าของห้องลับมาก", phone: `+6681${String(sfx).slice(-7)}`, agentId },
    });

    const project = await prisma.project.create({
      data: { name: `แอชตัน อโศก-สุขุมวิท ${sfx}`, district: "วัฒนา", province: "กรุงเทพมหานคร" },
    });

    const baseAsset = {
      category: "CONDO" as const,
      ownershipType: "AGENT" as const,
      ownerId: owner.id,
      projectId: project.id,
      petAllowed: true,
      forRent: true,
      primaryAgentId: agentId,
    };

    // ห้องที่ 1: ตรงทุกเงื่อนไข (CONDO, สุขุมวิท, งบ 25000, ONE_BED, 35 ตร.ม., เลี้ยงสัตว์ได้, ว่าง)
    const bestAsset = await prisma.asset.create({
      data: {
        ...baseAsset,
        code: `PR-${sfx}-1`,
        unitNo: "32/999",
        floor: 32,
        district: "วัฒนา",
        areaSqm: 35,
        roomType: "ONE_BEDROOM",
        bedrooms: 1,
        bathrooms: 1,
        rentPrice: 25000,
        minRentPrice: 22000,
        availableFrom: new Date("2026-11-01"),
        status: "AVAILABLE",
        internalNote: "รหัสประตูลับ 1234#",
        attributes: { floor: 32, roomType: "ONE_BEDROOM" },
      },
    });
    bestAssetId = bestAsset.id;

    const partialAsset = await prisma.asset.create({
      data: {
        ...baseAsset,
        code: `PR-${sfx}-2`,
        unitNo: "12/105",
        floor: 12,
        district: "วัฒนา",
        areaSqm: 28,
        roomType: "STUDIO",
        rentPrice: 21000,
        minRentPrice: 19000,
        status: "AVAILABLE",
        attributes: { floor: 12, roomType: "STUDIO" },
      },
    });
    partialAssetId = partialAsset.id;

    const thirdAsset = await prisma.asset.create({
      data: {
        ...baseAsset,
        code: `PR-${sfx}-3`,
        unitNo: "18/202",
        floor: 18,
        district: "คลองเตย",
        areaSqm: 36,
        roomType: "ONE_BEDROOM",
        rentPrice: 32000,
        minRentPrice: 29000,
        status: "AVAILABLE",
        attributes: { floor: 18, roomType: "ONE_BEDROOM" },
      },
    });
    thirdAssetId = thirdAsset.id;

    const unavail = await prisma.asset.create({
      data: {
        ...baseAsset,
        code: `PR-${sfx}-4`,
        unitNo: "99/999",
        areaSqm: 35,
        roomType: "ONE_BEDROOM",
        rentPrice: 25000,
        status: "CONTRACTED",
        attributes: { floor: 9, roomType: "ONE_BEDROOM" },
      },
    });
    unavailableAssetId = unavail.id;

    const lead = await prisma.lead.create({
      data: {
        code: `LD-${sfx}`,
        intent: "RENT",
        fullName: "คุณลูกค้า ทดสอบจับคู่",
        phone: `+6685${String(sfx).slice(-7)}`,
        budgetMin: 20000,
        budgetMax: 30000,
        preferredLocation: "สุขุมวิท",
        preferredProjectId: project.id,
        preferredCategory: "CONDO",
        preferredRoomType: "ONE_BEDROOM",
        minAreaSqm: 32,
        moveInDate: new Date("2026-11-15"),
        leaseMonths: 12,
        petRequired: true,
        source: "FACEBOOK",
        ownerAgentId: agentId,
      },
    });
    leadId = lead.id;
  });

  afterAll(async () => {
    await app?.close();
  });

  it("ดึงรายการจับคู่ห้องจากเงื่อนไข Lead อัตโนมัติ เรียงตามคะแนนความตรง และคัดเฉพาะห้องว่าง", async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/leads/${leadId}/matches`)
      .set("Authorization", `Bearer ${agentToken}`)
      .expect(200);

    expect(res.body.criteria.intent).toBe("RENT");
    expect(res.body.criteria.petRequired).toBe(true);

    const ids = res.body.items.map((x: { id: string }) => x.id);
    expect(ids).toContain(bestAssetId);
    expect(ids).toContain(partialAssetId);
    expect(ids).not.toContain(unavailableAssetId);

    // ห้องที่ตรงทุกเงื่อนไข (PR-900001) ต้องอยู่ลำดับแรกด้วยคะแนนสูงสุด
    expect(res.body.items[0].id).toBe(bestAssetId);
    expect(res.body.items[0].matchScore).toBeGreaterThan(res.body.items[1].matchScore);
  });

  it("เลือก 3 ห้อง บันทึกเป็น lead_offers พร้อมสร้างลิงก์แชร์ 7 วัน และหน้า public ไม่มี minPrice/เลขห้อง/เจ้าของ", async () => {
    const offerRes = await request(app.getHttpServer())
      .post(`/api/v1/leads/${leadId}/offers`)
      .set("Authorization", `Bearer ${agentToken}`)
      .send({
        items: [
          { assetId: bestAssetId, offeredPrice: 24500, note: "ห้องมุมวิวสวย" },
          { assetId: partialAssetId, offeredPrice: 20500 },
          { assetId: thirdAssetId, offeredPrice: 28500 },
        ],
      })
      .expect(201);

    expect(offerRes.body.shareToken).toBeTruthy();
    expect(offerRes.body.offers).toHaveLength(3);

    const shareToken = offerRes.body.shareToken as string;

    // เปิดลิงก์แชร์โดยไม่ต้องล็อกอิน (Public)
    const publicRes = await request(app.getHttpServer()).get(`/api/v1/public/offers/${shareToken}`).expect(200);

    expect(publicRes.body.items).toHaveLength(3);
    for (const item of publicRes.body.items) {
      expect(item.minRentPrice).toBeUndefined();
      expect(item.minSalePrice).toBeUndefined();
      expect(item.unitNo).toBeUndefined();
      expect(item.owner).toBeUndefined();
      expect(item.ownerId).toBeUndefined();
      expect(item.internalNote).toBeUndefined();
      expect(item.code).toBeTruthy();
    }
  });
});
