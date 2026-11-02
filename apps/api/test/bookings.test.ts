import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaService } from "../src/prisma/prisma.service";
import { PASSWORD, createTestApp, createUser, resetRoleCache } from "./helpers";

describe("P11 · ผลติดตามหลังนัดดูห้อง + การจอง (Booking) และ Concurrency 10 requests", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let agentToken: string;
  let agentId: string;
  let leadId: string;
  let asset1Id: string;
  let asset2Id: string;
  let concurrentAssetId: string;

  beforeAll(async () => {
    resetRoleCache();
    ({ app, prisma } = await createTestApp());
    const sfx = Date.now();
    const email = `agent.p11.${sfx}@test.local`;
    const team = await prisma.team.create({ data: { name: `ทีม P11 ${sfx}` } });
    const agent = await createUser(app, { email, role: "AGENT", teamId: team.id });
    agentId = agent.id;

    const loginRes = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email, password: PASSWORD })
      .expect(200);
    agentToken = loginRes.body.accessToken;

    const owner = await prisma.owner.create({
      data: { code: `OW-${sfx}`, fullName: "เจ้าของ P11", phone: `+6683${String(sfx).slice(-7)}`, agentId },
    });

    const baseAsset = {
      category: "CONDO" as const,
      ownershipType: "AGENT" as const,
      ownerId: owner.id,
      forRent: true,
      rentPrice: 25000,
      primaryAgentId: agentId,
      attributes: { floor: 15, roomType: "ONE_BEDROOM" },
    };

    const [a1, a2, a3] = await Promise.all([
      prisma.asset.create({ data: { ...baseAsset, code: `PR-${sfx}-1`, unitNo: "15/1", status: "AVAILABLE" } }),
      prisma.asset.create({ data: { ...baseAsset, code: `PR-${sfx}-2`, unitNo: "15/2", status: "AVAILABLE" } }),
      prisma.asset.create({ data: { ...baseAsset, code: `PR-${sfx}-3`, unitNo: "15/3", status: "AVAILABLE" } }),
    ]);
    asset1Id = a1.id;
    asset2Id = a2.id;
    concurrentAssetId = a3.id;

    const lead = await prisma.lead.create({
      data: {
        code: `LD-${sfx}`,
        intent: "RENT",
        fullName: "ลูกค้า จองห้อง P11",
        phone: `+6687${String(sfx).slice(-7)}`,
        source: "LINE",
        status: "NEW",
        ownerAgentId: agentId,
      },
    });
    leadId = lead.id;
  });

  afterAll(async () => {
    await app?.close();
  });

  it("เมื่อเปลี่ยนนัดเป็น COMPLETED บังคับบันทึกผลต่อห้อง + วันติดตามถัดไป และอัปเดตสถานะ Lead/Asset เป็น NEGOTIATING", async () => {
    const apptRes = await request(app.getHttpServer())
      .post("/api/v1/appointments")
      .set("Authorization", `Bearer ${agentToken}`)
      .send({
        leadId,
        startsAt: "2026-11-15T10:00:00.000Z",
        endsAt: "2026-11-15T12:00:00.000Z",
        agentId,
        assetIds: [asset1Id, asset2Id],
      })
      .expect(201);
    const apptId = apptRes.body.appointment.id as string;

    // ไม่ส่ง outcomes หรือส่งไม่ครบทุกห้อง ต้องได้ 400 FOLLOW_UP_REQUIRED
    const failRes = await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${apptId}/status`)
      .set("Authorization", `Bearer ${agentToken}`)
      .send({ status: "COMPLETED" })
      .expect(400);
    expect(failRes.body.code).toBe("FOLLOW_UP_REQUIRED");

    // ส่งครบทั้ง 2 ห้อง + nextFollowUpAt
    const nextFollowUpAt = "2026-11-17T10:00:00.000Z";
    const okRes = await request(app.getHttpServer())
      .patch(`/api/v1/appointments/${apptId}/status`)
      .set("Authorization", `Bearer ${agentToken}`)
      .send({
        status: "COMPLETED",
        nextFollowUpAt,
        note: "ลูกค้าตกลงเอาห้อง 15/1 และไม่สนใจห้อง 15/2",
        outcomes: [
          { assetId: asset1Id, outcome: "AGREED", outcomeNote: "ตกลงจองสัปดาห์หน้า" },
          { assetId: asset2Id, outcome: "NOT_INTERESTED", outcomeNote: "วิวบัง" },
        ],
      })
      .expect(200);

    expect(okRes.body.status).toBe("COMPLETED");
    const [lead, asset1, asset2, activities] = await Promise.all([
      prisma.lead.findUniqueOrThrow({ where: { id: leadId } }),
      prisma.asset.findUniqueOrThrow({ where: { id: asset1Id } }),
      prisma.asset.findUniqueOrThrow({ where: { id: asset2Id } }),
      prisma.activity.findMany({ where: { appointmentId: apptId, type: "FOLLOW_UP" } }),
    ]);
    expect(lead.status).toBe("NEGOTIATING");
    expect(lead.nextFollowUpAt?.toISOString()).toBe(nextFollowUpAt);
    expect(asset1.status).toBe("NEGOTIATING");
    expect(asset2.status).toBe("AVAILABLE");
    expect(activities).toHaveLength(1);
  });

  it("สร้าง Booking รอชำระ → ชำระเงินจอง → ห้องเป็น BOOKED และ Lead เป็น BOOKED → ยกเลิกคืนเงินจอง สถานะห้องคำนวณกลับอัตโนมัติ", async () => {
    const createRes = await request(app.getHttpServer())
      .post("/api/v1/bookings")
      .set("Authorization", `Bearer ${agentToken}`)
      .send({
        leadId,
        assetId: asset1Id,
        monthlyRent: 25000,
        bookingFee: 10000,
        securityDeposit: 50000,
        advanceRent: 25000,
        startDate: "2026-12-01",
        endDate: "2027-11-30",
        note: "รอโอนเงินจองภายในวันนี้",
      })
      .expect(201);

    const bookingId = createRes.body.id as string;
    expect(createRes.body.code).toMatch(/^BK-/);
    expect(createRes.body.status).toBe("PENDING_PAYMENT");

    // ยืนยันรับชำระเงินจอง
    const payRes = await request(app.getHttpServer())
      .post(`/api/v1/bookings/${bookingId}/pay`)
      .set("Authorization", `Bearer ${agentToken}`)
      .send({ method: "BANK_TRANSFER", reference: "SLIP-001" })
      .expect(200);

    expect(payRes.body.status).toBe("PAID");
    expect(payRes.body.payments).toHaveLength(1);
    expect(payRes.body.asset.status).toBe("BOOKED");
    expect(payRes.body.lead.status).toBe("BOOKED");

    // ยกเลิกการจองพร้อมคืนเงินจอง (feeForfeited = false)
    const cancelRes = await request(app.getHttpServer())
      .post(`/api/v1/bookings/${bookingId}/cancel`)
      .set("Authorization", `Bearer ${agentToken}`)
      .send({ cancelReason: "เจ้าของห้องเปลี่ยนใจไม่ปล่อยเช่า", feeForfeited: false })
      .expect(200);

    expect(cancelRes.body.status).toBe("CANCELLED");
    expect(cancelRes.body.feeForfeited).toBe(false);
    expect(cancelRes.body.payments).toHaveLength(2);
    // มีผลติดตาม AGREED จากเคสก่อนหน้า ห้องจึงกลับไปเป็น NEGOTIATING (ไม่ใช่ BOOKED)
    expect(cancelRes.body.asset.status).toBe("NEGOTIATING");
  });

  it("Concurrency test: ยิงจอง+ชำระเงินห้องเดียวกันช่วงเดียวกันพร้อมกัน 10 requests สำเร็จได้ 1 เท่านั้น และที่เหลือได้ 409 PERIOD_OVERLAP พร้อมรหัส BK ที่ชน", async () => {
    const payload = {
      leadId,
      assetId: concurrentAssetId,
      monthlyRent: 25000,
      bookingFee: 10000,
      securityDeposit: 50000,
      advanceRent: 25000,
      startDate: "2026-12-01",
      endDate: "2027-11-30",
      payImmediately: true,
      paymentMethod: "PROMPTPAY",
    };

    const responses = await Promise.all(
      Array.from({ length: 10 }, () =>
        request(app.getHttpServer())
          .post("/api/v1/bookings")
          .set("Authorization", `Bearer ${agentToken}`)
          .send(payload),
      ),
    );

    const successes = responses.filter((r) => r.status === 201);
    const conflicts = responses.filter((r) => r.status === 409);

    expect(successes).toHaveLength(1);
    expect(conflicts).toHaveLength(9);

    const winnerCode = successes[0]!.body.code as string;
    for (const c of conflicts) {
      expect(c.body.code).toBe("PERIOD_OVERLAP");
      expect(c.body.message).toContain("ห้องนี้มีการจองหรือสัญญาในช่วงวันที่นี้แล้ว");
    }

    // ยิงซ้ำอีก 1 ครั้งหลังชนะแล้ว ต้องระบุรหัสการจองที่ชนกันชัดเจน
    const afterWinnerRes = await request(app.getHttpServer())
      .post("/api/v1/bookings")
      .set("Authorization", `Bearer ${agentToken}`)
      .send(payload)
      .expect(409);

    expect(afterWinnerRes.body.code).toBe("PERIOD_OVERLAP");
    expect(afterWinnerRes.body.message).toBe(`ห้องนี้มีการจองหรือสัญญาในช่วงวันที่นี้แล้ว (ชนกับ ${winnerCode})`);
    expect(afterWinnerRes.body.details.conflictingCode).toBe(winnerCode);
  });
});
