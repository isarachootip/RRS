import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaService } from "../src/prisma/prisma.service";
import { PASSWORD, createTestApp, createUser, resetRoleCache } from "./helpers";

describe("P10 · ระบบนัดดูห้อง (Appointment Management), ตรวจนัดซ้อน, เลื่อนนัด, ปฏิทินทีม และสถานะอัตโนมัติ", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let agentAToken: string;
  let agentBToken: string;
  let agentAId: string;
  let leadId: string;
  let asset1Id: string;
  let asset2Id: string;
  let asset3Id: string;
  let firstAppointmentId: string;

  beforeAll(async () => {
    resetRoleCache();
    ({ app, prisma } = await createTestApp());
    const sfx = Date.now();
    const emailA = `agenta.p10.${sfx}@test.local`;
    const emailB = `agentb.p10.${sfx}@test.local`;

    const team = await prisma.team.create({ data: { name: `ทีม P10 ${sfx}` } });
    const agentA = await createUser(app, { email: emailA, role: "AGENT", teamId: team.id });
    await createUser(app, { email: emailB, role: "AGENT", teamId: team.id });
    agentAId = agentA.id;

    const [loginA, loginB] = await Promise.all([
      request(app.getHttpServer()).post("/api/v1/auth/login").send({ email: emailA, password: PASSWORD }).expect(200),
      request(app.getHttpServer()).post("/api/v1/auth/login").send({ email: emailB, password: PASSWORD }).expect(200),
    ]);
    agentAToken = loginA.body.accessToken;
    agentBToken = loginB.body.accessToken;

    const owner = await prisma.owner.create({
      data: { code: `OW-${sfx}`, fullName: "เจ้าของ P10", phone: `+6682${String(sfx).slice(-7)}`, agentId: agentAId },
    });

    const baseAsset = {
      category: "CONDO" as const,
      ownershipType: "AGENT" as const,
      ownerId: owner.id,
      forRent: true,
      rentPrice: 20000,
      primaryAgentId: agentAId,
      attributes: { floor: 10, roomType: "ONE_BEDROOM" },
    };

    const [a1, a2, a3] = await Promise.all([
      prisma.asset.create({ data: { ...baseAsset, code: `PR-${sfx}-1`, unitNo: "10/1", status: "AVAILABLE" } }),
      prisma.asset.create({ data: { ...baseAsset, code: `PR-${sfx}-2`, unitNo: "10/2", status: "AVAILABLE" } }),
      prisma.asset.create({ data: { ...baseAsset, code: `PR-${sfx}-3`, unitNo: "10/3", status: "AVAILABLE" } }),
    ]);
    asset1Id = a1.id;
    asset2Id = a2.id;
    asset3Id = a3.id;

    const lead = await prisma.lead.create({
      data: {
        code: `LD-${sfx}`,
        intent: "RENT",
        fullName: "ลูกค้า นัดดูห้อง",
        phone: `+6686${String(sfx).slice(-7)}`,
        source: "LINE",
        status: "NEW",
        ownerAgentId: agentAId,
      },
    });
    leadId = lead.id;
  });

  afterAll(async () => {
    await app?.close();
  });

  it("สร้างนัด 1 ครั้ง 3 ห้อง → ห้องว่างเปลี่ยนเป็น VIEWING_SCHEDULED และ Lead เปลี่ยนเป็น VIEWING อัตโนมัติ", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/appointments")
      .set("Authorization", `Bearer ${agentAToken}`)
      .send({
        leadId,
        startsAt: "2026-11-10T10:00:00.000Z",
        endsAt: "2026-11-10T12:00:00.000Z",
        location: "ล็อบบี้ อาคาร A",
        agentId: agentAId,
        coordinatorName: "นิติบุคคล อาคาร A",
        coordinatorPhone: "02-111-2222",
        note: "ขอดู 3 ห้องเปรียบเทียบกัน",
        assetIds: [asset1Id, asset2Id, asset3Id],
      })
      .expect(201);

    expect(res.body.appointment.code).toMatch(/^AP-/);
    expect(res.body.appointment.items).toHaveLength(3);
    firstAppointmentId = res.body.appointment.id;

    const [updatedLead, updatedAssets] = await Promise.all([
      prisma.lead.findUniqueOrThrow({ where: { id: leadId } }),
      prisma.asset.findMany({ where: { id: { in: [asset1Id, asset2Id, asset3Id] } } }),
    ]);
    expect(updatedLead.status).toBe("VIEWING");
    for (const a of updatedAssets) {
      expect(a.status).toBe("VIEWING_SCHEDULED");
    }
  });

  it("ตรวจนัดซ้อนของ Agent คนเดียวกัน (tstzrange overlap) → เตือน 409 ก่อน และบันทึกได้เมื่อ confirmOverlap = true", async () => {
    const conflictRes = await request(app.getHttpServer())
      .post("/api/v1/appointments")
      .set("Authorization", `Bearer ${agentAToken}`)
      .send({
        leadId,
        startsAt: "2026-11-10T11:00:00.000Z",
        endsAt: "2026-11-10T13:00:00.000Z",
        agentId: agentAId,
        assetIds: [asset1Id],
      })
      .expect(409);

    expect(conflictRes.body.code).toBe("APPOINTMENT_OVERLAP_WARNING");
    expect(conflictRes.body.details.overlaps).toHaveLength(1);
    expect(conflictRes.body.details.overlaps[0].id).toBe(firstAppointmentId);

    const confirmedRes = await request(app.getHttpServer())
      .post("/api/v1/appointments")
      .set("Authorization", `Bearer ${agentAToken}`)
      .send({
        leadId,
        startsAt: "2026-11-10T11:00:00.000Z",
        endsAt: "2026-11-10T13:00:00.000Z",
        agentId: agentAId,
        assetIds: [asset1Id],
        confirmOverlap: true,
      })
      .expect(201);

    expect(confirmedRes.body.overlapWarning).toBe(true);
    // ยกเลิกนัดที่สองเพื่อไม่ให้ค้างในเคสถัดไป
    await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${confirmedRes.body.appointment.id}/status`)
      .set("Authorization", `Bearer ${agentAToken}`)
      .send({ status: "CANCELLED" })
      .expect(200);
  });

  it("เลื่อนนัด → นัดเดิมเป็น RESCHEDULED สร้างนัดใหม่ผูก rescheduledFromId และปฏิทินทีมซ่อนรายละเอียดนัดคนอื่นเป็น 'ไม่ว่าง'", async () => {
    const reschedRes = await request(app.getHttpServer())
      .post(`/api/v1/appointments/${firstAppointmentId}/reschedule`)
      .set("Authorization", `Bearer ${agentAToken}`)
      .send({
        startsAt: "2026-11-12T14:00:00.000Z",
        endsAt: "2026-11-12T16:00:00.000Z",
        note: "ลูกค้าขอเลื่อนเป็นวันพฤหัส",
      })
      .expect(201);

    const newApptId = reschedRes.body.appointment.id as string;
    expect(reschedRes.body.appointment.rescheduledFromId).toBe(firstAppointmentId);

    const oldAppt = await prisma.appointment.findUniqueOrThrow({ where: { id: firstAppointmentId } });
    expect(oldAppt.status).toBe("RESCHEDULED");

    // Agent B ดูปฏิทินรวม เห็นนัดของ Agent A เป็นแค่ "ไม่ว่าง"
    const calB = await request(app.getHttpServer())
      .get("/api/v1/appointments/calendar")
      .query({ from: "2026-11-01T00:00:00.000Z", to: "2026-11-30T23:59:59.000Z", agentId: agentAId })
      .set("Authorization", `Bearer ${agentBToken}`)
      .expect(200);

    const busyItem = calB.body.items.find((x: { id: string }) => x.id === newApptId);
    expect(busyItem).toBeDefined();
    expect(busyItem.isBusyOnly).toBe(true);
    expect(busyItem.title).toBe("ไม่ว่าง");
    expect(busyItem.lead).toBeNull();
    expect(busyItem.items).toEqual([]);

    // ยกเลิกนัดใหม่ → ห้องทั้ง 3 กลับเป็น AVAILABLE อัตโนมัติ
    await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${newApptId}/status`)
      .set("Authorization", `Bearer ${agentAToken}`)
      .send({ status: "CANCELLED" })
      .expect(200);

    const assetsAfterCancel = await prisma.asset.findMany({ where: { id: { in: [asset1Id, asset2Id, asset3Id] } } });
    for (const a of assetsAfterCancel) {
      expect(a.status).toBe("AVAILABLE");
    }
  });
});
