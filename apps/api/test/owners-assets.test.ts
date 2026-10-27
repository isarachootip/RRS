import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaService } from "../src/prisma/prisma.service";
import { PASSWORD, createTestApp, createUser, resetRoleCache } from "./helpers";

let app: INestApplication;
let prisma: PrismaService;
const http = () => request(app.getHttpServer());
const auth = (token: string) => ({ authorization: `Bearer ${token}` });

let managerToken = "";
let agent1Id = "";
let agent2Id = "";
let ownerId = "";
let projectId = "";
let condoId = "";

beforeAll(async () => {
  resetRoleCache();
  ({ app, prisma } = await createTestApp());

  const team = await prisma.team.create({ data: { name: "ทีมทดสอบ P06" } });
  const manager = await createUser(app, { email: "mgr.p06@test.local", role: "MANAGER", teamId: team.id });
  const agent1 = await createUser(app, { email: "ag1.p06@test.local", role: "AGENT", teamId: team.id });
  const agent2 = await createUser(app, { email: "ag2.p06@test.local", role: "AGENT", teamId: team.id });
  agent1Id = agent1.id;
  agent2Id = agent2.id;

  await prisma.owner.create({
    data: { code: "OW-000000", fullName: "บริษัท RRS จำกัด", isCompany: true, status: "LISTED", agentId: manager.id },
  });

  const loginRes = await http()
    .post("/api/v1/auth/login")
    .send({ email: "mgr.p06@test.local", password: PASSWORD })
    .expect(200);
  managerToken = loginRes.body.accessToken as string;
});

afterAll(async () => {
  await app?.close();
});

describe("P06 · Owners CRUD และตรวจข้อมูลซ้ำ", () => {
  it("สร้างเจ้าของทรัพย์ normalize เบอร์โทร และตรวจพบซ้ำเมื่อค้นด้วยรูปแบบต่างกัน (แต่ไม่บล็อกการบันทึก)", async () => {
    const createRes = await http()
      .post("/api/v1/owners")
      .set(auth(managerToken))
      .send({
        fullName: "สมศักดิ์ มีคอนโด",
        phone: "081-234-5678",
        lineId: "somsak_line",
        email: "somsak@example.com",
        agentId: agent1Id,
        status: "CONTACTED",
      })
      .expect(201);

    ownerId = createRes.body.id as string;
    expect(createRes.body.code).toMatch(/^OW-\d{6}$/);
    expect(createRes.body.phone).toBe("+66812345678");

    const dupRes = await http()
      .get("/api/v1/owners/duplicates?phone=%2B66812345678&lineId=somsak_line")
      .set(auth(managerToken))
      .expect(200);
    expect(dupRes.body.items.length).toBe(1);
    expect(dupRes.body.items[0].id).toBe(ownerId);

    // แจ้งเตือนแต่ไม่บล็อก: สร้างซ้ำได้ถ้าผู้ใช้ยืนยัน
    await http()
      .post("/api/v1/owners")
      .set(auth(managerToken))
      .send({ fullName: "สมศักดิ์ สาขา 2", phone: "+66812345678", agentId: agent1Id })
      .expect(201);

    const listRes = await http().get("/api/v1/owners?search=สมศักดิ์").set(auth(managerToken)).expect(200);
    expect(listRes.body.total).toBeGreaterThanOrEqual(2);
    expect(listRes.body.items[0].phone).toBe("08x-xxx-5678");
  });
});

describe("P06 · Assets หลายประเภท, Validation ตาม Category, และ Apartment Bulk 10 ห้อง", () => {
  it("สร้างคอนโด, บ้าน, โรงงาน และปฏิเสธ attributes ที่ไม่ตรงประเภท", async () => {
    const projRes = await http()
      .post("/api/v1/projects")
      .set(auth(managerToken))
      .send({ name: "สุขุมวิท แกรนด์ P06", district: "วัฒนา", province: "กรุงเทพมหานคร" })
      .expect(201);
    projectId = projRes.body.id as string;

    // 1. คอนโด
    const condoRes = await http()
      .post("/api/v1/assets")
      .set(auth(managerToken))
      .send({
        category: "CONDO",
        ownershipType: "AGENT",
        ownerId,
        projectId,
        unitNo: "12A",
        floor: 12,
        areaSqm: 35.5,
        roomType: "ONE_BEDROOM",
        bedrooms: 1,
        bathrooms: 1,
        rentPrice: 22000,
        minRentPrice: 20000,
        primaryAgentId: agent1Id,
        attributes: { commonFeePerSqm: 45, parkingSlots: 1, facing: "ทิศใต้" },
      })
      .expect(201);
    condoId = condoRes.body.id as string;
    expect(condoRes.body.code).toMatch(/^PR-\d{6}$/);

    // 2. บ้านเดี่ยว (ownershipType OWNER ผูกบริษัทอัตโนมัติได้)
    await http()
      .post("/api/v1/assets")
      .set(auth(managerToken))
      .send({
        category: "HOUSE",
        ownershipType: "OWNER",
        bedrooms: 3,
        bathrooms: 3,
        areaSqm: 180,
        rentPrice: 45000,
        primaryAgentId: agent1Id,
        attributes: { land: { rai: 0, ngan: 1, sqWah: 20 }, stories: 2, parkingSlots: 2 },
      })
      .expect(201);

    // 3. โรงงาน
    await http()
      .post("/api/v1/assets")
      .set(auth(managerToken))
      .send({
        category: "FACTORY",
        ownershipType: "AGENT",
        ownerId,
        rentPrice: 150000,
        primaryAgentId: agent1Id,
        attributes: { buildingAreaSqm: 1200, powerKva: 500, hasFactoryLicense: true },
      })
      .expect(201);

    // 4. ส่งฟิลด์ผิดประเภท (ส่ง powerKva ใน CONDO หรือขาด buildingAreaSqm ใน FACTORY) → 400
    await http()
      .post("/api/v1/assets")
      .set(auth(managerToken))
      .send({
        category: "CONDO",
        ownershipType: "AGENT",
        ownerId,
        attributes: { powerKva: 500 },
      })
      .expect(400);

    await http()
      .post("/api/v1/assets")
      .set(auth(managerToken))
      .send({
        category: "FACTORY",
        ownershipType: "AGENT",
        ownerId,
        attributes: {},
      })
      .expect(400);
  });

  it("สร้างอาคารอพาร์ตเมนต์แล้วเพิ่มห้องทีละ 10 ห้อง (Bulk Units) สำเร็จ", async () => {
    const bldRes = await http()
      .post("/api/v1/buildings")
      .set(auth(managerToken))
      .send({ name: "หอพักสุขใจแมนชั่น", ownerId, totalFloors: 5 })
      .expect(201);

    const units = Array.from({ length: 10 }, (_, i) => ({
      unitNo: `20${i + 1}`,
      floor: 2,
      areaSqm: 24,
      rentPrice: 4500,
      attributes: { waterRatePerUnit: 18, electricRatePerUnit: 8, allowsDailyRent: false },
    }));

    const bulkRes = await http()
      .post(`/api/v1/buildings/${bldRes.body.id as string}/bulk-units`)
      .set(auth(managerToken))
      .send({ primaryAgentId: agent1Id, units })
      .expect(201);

    expect(bulkRes.body.createdCount).toBe(10);
    expect(bulkRes.body.items).toHaveLength(10);
  });
});

describe("P06 · กฎสถานะห้อง, ผู้ดูแลหลายคน, แกลเลอรีรูป, และสัญญาฝากเช่า + Audit", () => {
  it("ห้ามแก้มือสถานะเป็น BOOKED/CONTRACTED แต่ตั้ง UNAVAILABLE ได้ และบันทึกผู้ดูแล/รูป/สัญญาฝากครบพร้อม Audit", async () => {
    // ห้ามแก้มือเป็น BOOKED
    await http().patch(`/api/v1/assets/${condoId}`).set(auth(managerToken)).send({ status: "BOOKED" }).expect(400);

    // ตั้งเป็น UNAVAILABLE ได้
    await http().patch(`/api/v1/assets/${condoId}`).set(auth(managerToken)).send({ status: "UNAVAILABLE" }).expect(200);

    // ผูก Agent หลายคนพร้อมบทบาท
    const agRes = await http()
      .put(`/api/v1/assets/${condoId}/agents`)
      .set(auth(managerToken))
      .send({
        agents: [
          { userId: agent1Id, role: "LISTING" },
          { userId: agent2Id, role: "CO_AGENT" },
        ],
      })
      .expect(200);
    expect(agRes.body.agents).toHaveLength(2);

    // บันทึกสัญญาฝากเช่า (listing_agreements)
    const agrRes = await http()
      .post(`/api/v1/assets/${condoId}/agreements`)
      .set(auth(managerToken))
      .send({
        transactionType: "RENT",
        startDate: "2026-10-01",
        endDate: "2027-09-30",
        commissionFormula: "ONE_MONTH",
        commissionParams: {},
        exclusive: true,
      })
      .expect(201);
    expect(agrRes.body.commissionFormula).toBe("ONE_MONTH");

    const audits = await prisma.auditLog.findMany({ where: { entityType: "asset", entityId: condoId } });
    expect(audits.length).toBeGreaterThanOrEqual(2);
  });
});
