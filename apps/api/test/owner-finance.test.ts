import type { INestApplication } from "@nestjs/common";
import { authenticator } from "otplib";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaService } from "../src/prisma/prisma.service";
import { PASSWORD, createTestApp, createUser, resetRoleCache } from "./helpers";
import {
  EXPECTED_ROOM1_MONTHLY_NET,
  EXPECTED_ROOM2_MONTHLY_NET,
  EXPECTED_ROOM3_MONTHLY_NET,
  seedThreeOwnerRoomsTwelveMonths,
} from "./owner-finance.fixture";

describe("P13 · การเงินห้อง Owner (รับเงิน, งวดค่าเช่าอัตโนมัติ, ค่าใช้จ่าย, รายงานรายได้สุทธิ 3 ห้อง × 12 เดือน)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken = "";
  let adminId = "";
  let companyOwnerId = "";
  let leadId = "";
  let scheduleRoomId = "";
  let reportRoomIds: [string, string, string] = ["", "", ""];

  beforeAll(async () => {
    resetRoleCache();
    ({ app, prisma } = await createTestApp());
    const sfx = Date.now();
    const email = `admin.p13.${sfx}@test.local`;
    const admin = await createUser(app, { email, role: "ADMIN" });
    adminId = admin.id;

    const loginRes = await request(app.getHttpServer()).post("/api/v1/auth/login").send({ email, password: PASSWORD });
    if (loginRes.body.status === "OK") {
      adminToken = loginRes.body.accessToken;
    } else {
      const challengeToken = loginRes.body.challengeToken as string;
      const setup = await request(app.getHttpServer()).post("/api/v1/auth/mfa/setup").send({ challengeToken });
      const code = authenticator.generate(setup.body.secret as string);
      const enabled = await request(app.getHttpServer()).post("/api/v1/auth/mfa/enable").send({ challengeToken, code });
      adminToken = enabled.body.accessToken;
    }

    const companyOwner = await prisma.owner.create({
      data: {
        code: `OW-COMP-${sfx}`,
        fullName: "บริษัท อาร์อาร์เอส จำกัด",
        phone: `+6681${String(sfx).slice(-7)}`,
        isCompany: true,
        agentId: adminId,
      },
    });
    companyOwnerId = companyOwner.id;

    const base = {
      ownershipType: "OWNER" as const,
      ownerId: companyOwnerId,
      category: "CONDO" as const,
      primaryAgentId: adminId,
    };
    const [schedRoom, r1, r2, r3] = await Promise.all([
      prisma.asset.create({ data: { ...base, code: `PR-SCH-${sfx}`, rentPrice: "25000.50" } }),
      prisma.asset.create({ data: { ...base, code: `PR-R1-${sfx}`, rentPrice: "25000.50" } }),
      prisma.asset.create({ data: { ...base, code: `PR-R2-${sfx}`, rentPrice: "18500.25" } }),
      prisma.asset.create({ data: { ...base, code: `PR-R3-${sfx}`, rentPrice: "42000.75" } }),
    ]);
    scheduleRoomId = schedRoom.id;
    reportRoomIds = [r1.id, r2.id, r3.id];

    const lead = await prisma.lead.create({
      data: {
        code: `LD-P13-${sfx}`,
        intent: "RENT",
        fullName: "ผู้เช่า P13",
        phone: `+6685${String(sfx).slice(-7)}`,
        source: "LINE",
        ownerAgentId: adminId,
      },
    });
    leadId = lead.id;
  });

  afterAll(async () => {
    await app?.close();
  });

  it("สร้างสัญญาเช่าห้อง OWNER สถานะ ACTIVE → สร้าง rent_schedules อัตโนมัติ 12 งวด และตัดยอด PARTIAL → PAID เมื่อรับเงิน", async () => {
    const cRes = await request(app.getHttpServer())
      .post("/api/v1/contracts")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        assetId: scheduleRoomId,
        leadId,
        monthlyRent: 25000.5,
        securityDeposit: 50001,
        advanceRent: 25000.5,
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        status: "ACTIVE",
      })
      .expect(201);

    const schedRes = await request(app.getHttpServer())
      .get(`/api/v1/finance/rent-schedules?contractId=${cRes.body.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(schedRes.body).toHaveLength(12);
    const janScheduleId = schedRes.body[0].id as string;
    expect(schedRes.body[0].status).toBe("DUE");
    expect(String(schedRes.body[0].amountDue)).toBe("25000.5");

    const partialPay = await request(app.getHttpServer())
      .post("/api/v1/finance/payments")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        type: "MONTHLY_RENT",
        amount: "10000.25",
        paidAt: "2026-01-03T09:00:00.000Z",
        method: "PROMPTPAY",
        rentScheduleId: janScheduleId,
        reference: "SLIP-PART-1",
      })
      .expect(201);

    expect(partialPay.body.rentSchedule.status).toBe("PARTIAL");
    expect(String(partialPay.body.rentSchedule.amountPaid)).toBe("10000.25");

    const fullPay = await request(app.getHttpServer())
      .post("/api/v1/finance/payments")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        type: "MONTHLY_RENT",
        amount: "15000.25",
        paidAt: "2026-01-05T11:00:00.000Z",
        method: "BANK_TRANSFER",
        rentScheduleId: janScheduleId,
        reference: "SLIP-PART-2",
      })
      .expect(201);

    expect(fullPay.body.rentSchedule.status).toBe("PAID");
    expect(String(fullPay.body.rentSchedule.amountPaid)).toBe("25000.5");
  });

  it("คำนวณรายได้สุทธิต่อห้องต่อเดือน (Cash Basis) ด้วยชุดข้อมูล 3 ห้อง × 12 เดือน ตรงทุกสตางค์", async () => {
    await seedThreeOwnerRoomsTwelveMonths(prisma, reportRoomIds, adminId);

    const res = await request(app.getHttpServer())
      .get("/api/v1/finance/reports/owner-net-income?year=2027")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    const roomsById = new Map<
      string,
      { monthly: Array<{ month: string; netIncome: string }>; totals: Record<string, string> }
    >(
      res.body.rooms.map(
        (r: {
          assetId: string;
          monthly: Array<{ month: string; netIncome: string }>;
          totals: Record<string, string>;
        }) => [r.assetId, r],
      ),
    );

    const room1 = roomsById.get(reportRoomIds[0])!;
    const room2 = roomsById.get(reportRoomIds[1])!;
    const room3 = roomsById.get(reportRoomIds[2])!;

    for (const cell of room1.monthly) {
      expect(cell.netIncome).toBe(EXPECTED_ROOM1_MONTHLY_NET[cell.month]);
    }
    for (const cell of room2.monthly) {
      expect(cell.netIncome).toBe(EXPECTED_ROOM2_MONTHLY_NET[cell.month]);
    }
    for (const cell of room3.monthly) {
      expect(cell.netIncome).toBe(EXPECTED_ROOM3_MONTHLY_NET[cell.month]);
    }

    expect(room1.totals.netIncome).toBe("247505.25");
    expect(room1.totals.netIncomeSatang).toBe("24750525");

    expect(room2.totals.netIncome).toBe("171802.37");
    expect(room2.totals.netIncomeSatang).toBe("17180237");

    expect(room3.totals.netIncome).toBe("452757.40");
    expect(room3.totals.netIncomeSatang).toBe("45275740");

    // ตรวจผลรวมทั้ง 3 ห้อง (เมื่อไม่มีธุรกรรมของห้องอื่นในปี 2027)
    expect(res.body.grandTotals.rentCollected).toBe("990018.50");
    expect(res.body.grandTotals.otherIncome).toBe("3751.00");
    expect(res.body.grandTotals.commissionPaid).toBe("76501.63");
    expect(res.body.grandTotals.expenses).toBe("45202.85");
    expect(res.body.grandTotals.netIncome).toBe("872065.02");
    expect(res.body.grandTotals.netIncomeSatang).toBe("87206502");
  });
});
