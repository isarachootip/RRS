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
let managerId = "";
let agent1Token = "";
let agent1Id = "";
let agent2Token = "";
let agent2Id = "";
let leadId = "";

beforeAll(async () => {
  resetRoleCache();
  ({ app, prisma } = await createTestApp());

  const team = await prisma.team.create({ data: { name: "ทีมทดสอบ P07" } });
  const mgr = await createUser(app, { email: "mgr.p07@test.local", role: "MANAGER", teamId: team.id });
  const ag1 = await createUser(app, { email: "ag1.p07@test.local", role: "AGENT", teamId: team.id });
  const ag2 = await createUser(app, { email: "ag2.p07@test.local", role: "AGENT", teamId: team.id });
  await prisma.team.update({ where: { id: team.id }, data: { managerId: mgr.id } });

  managerId = mgr.id;
  agent1Id = ag1.id;
  agent2Id = ag2.id;

  const login = async (email: string) => {
    const res = await http().post("/api/v1/auth/login").send({ email, password: PASSWORD }).expect(200);
    return res.body.accessToken as string;
  };
  managerToken = await login("mgr.p07@test.local");
  agent1Token = await login("ag1.p07@test.local");
  agent2Token = await login("ag2.p07@test.local");
});

afterAll(async () => {
  await app?.close();
});

describe("P07 · Lead Creation, ตรวจเบอร์ซ้ำ (0812345678 vs +66812345678), และขอร่วมงาน", () => {
  it("agent2 สร้างลูกค้า +66812345678 → agent1 ค้น 0812345678 พบว่าซ้ำโดยไม่เปิดข้อมูลติดต่อ และกดขอร่วมงานได้", async () => {
    const createRes = await http()
      .post("/api/v1/leads")
      .set(auth(agent2Token))
      .send({
        intent: "RENT",
        fullName: "สมชาย ใจดี",
        phone: "+66812345678",
        lineId: "somchai_line",
        email: "somchai@example.com",
        budgetMin: 15000,
        budgetMax: 25000,
        preferredLocation: "อ่อนนุช",
        preferredCategory: "CONDO",
        source: "LINE",
      })
      .expect(201);

    leadId = createRes.body.id as string;
    expect(createRes.body.code).toMatch(/^LD-\d{6}$/);
    expect(createRes.body.ownerAgentId).toBe(agent2Id);

    // agent1 ตรวจซ้ำด้วยเบอร์ 0812345678 → เจอของ agent2 แต่ไม่เปิดเบอร์/LINE/อีเมล
    const dupRes = await http().get("/api/v1/leads/duplicates?phone=0812345678").set(auth(agent1Token)).expect(200);

    expect(dupRes.body.items).toHaveLength(1);
    expect(dupRes.body.items[0]).toMatchObject({
      id: leadId,
      fullName: "สมชาย จ.",
      ownerAgentId: agent2Id,
    });
    expect(dupRes.body.items[0].phone).toBeUndefined();
    expect(dupRes.body.items[0].lineId).toBeUndefined();

    // agent1 กดขอร่วมงาน (role: SHOWING) → สถานะ PENDING
    await http()
      .post(`/api/v1/leads/${leadId}/collaborators`)
      .set(auth(agent1Token))
      .send({ role: "SHOWING" })
      .expect(201);

    // ก่อนอนุมัติ agent1 ยังเปิดดูรายละเอียดไม่ได้ (403)
    await http().get(`/api/v1/leads/${leadId}`).set(auth(agent1Token)).expect(403);

    // agent2 (เจ้าของ Lead) อนุมัติคำขอร่วมงานของ agent1
    await http()
      .patch(`/api/v1/leads/${leadId}/collaborators/${agent1Id}`)
      .set(auth(agent2Token))
      .send({ role: "SHOWING", status: "APPROVED" })
      .expect(200);

    // หลังอนุมัติ agent1 เปิดดู Lead นี้ได้แล้ว
    await http().get(`/api/v1/leads/${leadId}`).set(auth(agent1Token)).expect(200);
  });
});

describe("P07 · การโอนเจ้าของ Lead (Lead Ownership) และประวัติการโอนครบทุกครั้ง", () => {
  it("Agent โอน Lead ไม่ได้ (403); Manager โอนได้พร้อมเหตุผล และบันทึก lead_assignments ครบทุกครั้ง", async () => {
    await http()
      .post(`/api/v1/leads/${leadId}/transfer`)
      .set(auth(agent1Token))
      .send({ toUserId: agent1Id, reason: "จะโอนเอง" })
      .expect(403);

    await http()
      .post(`/api/v1/leads/${leadId}/transfer`)
      .set(auth(agent2Token))
      .send({ toUserId: agent1Id, reason: "เจ้าของโอนเองไม่ได้ ต้องให้ Manager" })
      .expect(403);

    // Manager โอนจาก agent2 → agent1 พร้อมเหตุผล
    const transferRes = await http()
      .post(`/api/v1/leads/${leadId}/transfer`)
      .set(auth(managerToken))
      .send({ toUserId: agent1Id, reason: "Agent 2 ลาพักร้อน มอบหมายให้ Agent 1 ดูแลต่อ" })
      .expect(200);

    expect(transferRes.body.ownerAgentId).toBe(agent1Id);

    const detailRes = await http().get(`/api/v1/leads/${leadId}`).set(auth(managerToken)).expect(200);
    // มีทั้งแถวตอนสร้างครั้งแรก และแถวตอนโอน
    expect(detailRes.body.assignments).toHaveLength(2);
    expect(detailRes.body.assignments[0]).toMatchObject({
      fromUserId: agent2Id,
      toUserId: agent1Id,
      reason: "Agent 2 ลาพักร้อน มอบหมายให้ Agent 1 ดูแลต่อ",
    });
  });
});

describe("P07 · Pipeline สถานะ, กิจกรรม (Activities), และ Job แจ้งเตือนไม่มีกิจกรรมเกิน 30 วัน", () => {
  it("ย้อนสถานะหรือเปลี่ยนเป็น LOST โดยไม่ใส่เหตุผลถูกปฏิเสธ (400), บันทึกกิจกรรมได้, และ Job แจ้ง Manager เมื่อเกิน 30 วัน", async () => {
    // เลื่อนไปข้างหน้า NEW → CONTACTED → QUALIFIED ได้โดยไม่ต้องใส่เหตุผล
    await http()
      .patch(`/api/v1/leads/${leadId}/status`)
      .set(auth(agent1Token))
      .send({ status: "QUALIFIED" })
      .expect(200);

    // เปลี่ยนเป็น LOST โดยไม่ใส่เหตุผล → 400
    await http().patch(`/api/v1/leads/${leadId}/status`).set(auth(agent1Token)).send({ status: "LOST" }).expect(400);

    // เปลี่ยนเป็น LOST พร้อมเหตุผล → 200
    await http()
      .patch(`/api/v1/leads/${leadId}/status`)
      .set(auth(agent1Token))
      .send({ status: "LOST", reason: "ลูกค้าได้ห้องที่อื่นแล้ว" })
      .expect(200);

    // บันทึกกิจกรรม โทรติดตาม
    const actRes = await http()
      .post(`/api/v1/leads/${leadId}/activities`)
      .set(auth(agent1Token))
      .send({
        type: "CALL",
        body: "โทรสอบถามความต้องการเพิ่มเติม",
        nextFollowUpAt: "2026-11-05T03:00:00.000Z",
      })
      .expect(201);
    expect(actRes.body.type).toBe("CALL");

    // ทดสอบ Job ตรวจ Lead ที่ไม่มีกิจกรรมเกิน 30 วัน
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        status: "CONTACTED",
        lastActivityAt: new Date(Date.now() - 35 * 86_400_000),
      },
    });

    const jobRes = await http()
      .post("/api/v1/leads/jobs/check-inactive")
      .set(auth(managerToken))
      .send({ inactiveDays: 30 })
      .expect(200);

    expect(jobRes.body.notifiedCount).toBeGreaterThanOrEqual(1);
    const notif = await prisma.notification.findFirst({
      where: { userId: managerId, event: "lead.inactive" },
    });
    expect(notif).toBeTruthy();
  });
});
