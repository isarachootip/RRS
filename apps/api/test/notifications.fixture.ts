import type { INestApplication } from "@nestjs/common";
import { authenticator } from "otplib";
import request from "supertest";
import type { PrismaService } from "../src/prisma/prisma.service";
import { PASSWORD, createUser } from "./helpers";

export async function loginGetToken(app: INestApplication, email: string) {
  const res = await request(app.getHttpServer()).post("/api/v1/auth/login").send({ email, password: PASSWORD });
  if (res.body.status === "OK") return res.body.accessToken as string;
  const challengeToken = res.body.challengeToken as string;
  const setup = await request(app.getHttpServer()).post("/api/v1/auth/mfa/setup").send({ challengeToken });
  const code = authenticator.generate(setup.body.secret as string);
  const enabled = await request(app.getHttpServer()).post("/api/v1/auth/mfa/enable").send({ challengeToken, code });
  return enabled.body.accessToken as string;
}

export async function setupNotificationsFixture(app: INestApplication, prisma: PrismaService) {
  const sfx = Date.now();
  const team = await prisma.team.create({ data: { name: `ทีมแจ้งเตือน ${sfx}` } });

  const adminEmail = `adm.p17.${sfx}@test.local`;
  const mgrEmail = `mgr.p17.${sfx}@test.local`;
  const agentEmail = `ag.p17.${sfx}@test.local`;
  const coordEmail = `co.p17.${sfx}@test.local`;
  const accEmail = `acc.p17.${sfx}@test.local`;

  const admin = await createUser(app, { email: adminEmail, role: "ADMIN" });
  const mgr = await createUser(app, { email: mgrEmail, role: "MANAGER", teamId: team.id });
  const agent = await createUser(app, { email: agentEmail, role: "AGENT", teamId: team.id });
  const coordinator = await createUser(app, { email: coordEmail, role: "AGENT", teamId: team.id });
  const accounting = await createUser(app, { email: accEmail, role: "ACCOUNTING" });

  await prisma.team.update({ where: { id: team.id }, data: { managerId: mgr.id } });

  const adminToken = await loginGetToken(app, adminEmail);
  const mgrToken = await loginGetToken(app, mgrEmail);
  const agentToken = await loginGetToken(app, agentEmail);
  const coordToken = await loginGetToken(app, coordEmail);
  const accToken = await loginGetToken(app, accEmail);

  // ผูก LINE ให้ agent และ coordinator
  await request(app.getHttpServer())
    .post("/api/v1/notifications/line/link")
    .set("Authorization", `Bearer ${agentToken}`)
    .send({ lineUserId: `U_AGENT_${sfx}` })
    .expect(201);
  await request(app.getHttpServer())
    .post("/api/v1/notifications/line/link")
    .set("Authorization", `Bearer ${coordToken}`)
    .send({ lineUserId: `U_COORD_${sfx}` })
    .expect(201);

  const owner = await prisma.owner.create({
    data: {
      code: `OW-17-${sfx}`,
      fullName: "เจ้าของห้อง P17",
      phone: `+6681${String(sfx).slice(-7)}`,
      agentId: agent.id,
    },
  });

  const asset = await prisma.asset.create({
    data: {
      code: `PR-17-${sfx}`,
      category: "CONDO",
      ownershipType: "AGENT",
      ownerId: owner.id,
      primaryAgentId: agent.id,
      status: "CONTRACTED",
      forRent: true,
      rentPrice: "20000.00",
    },
  });

  const lead = await prisma.lead.create({
    data: {
      code: `LD-17-${sfx}`,
      intent: "RENT",
      source: "LINE",
      status: "VIEWING",
      fullName: "ลูกค้าทดสอบแจ้งเตือน",
      phone: `+6682${String(sfx).slice(-7)}`,
      ownerAgentId: agent.id,
    },
  });

  // นัดดูห้องวันที่ 2026-11-10 10:00:00Z
  const appointment = await prisma.appointment.create({
    data: {
      code: `AP-17-${sfx}`,
      leadId: lead.id,
      startsAt: new Date("2026-11-10T10:00:00.000Z"),
      endsAt: new Date("2026-11-10T11:00:00.000Z"),
      location: "ล็อบบี้ อาคาร A",
      agentId: agent.id,
      coordinatorId: coordinator.id,
      status: "CONFIRMED",
    },
  });

  // กิจกรรมติดตามลูกค้าที่กำหนดวันที่ 2026-11-10 08:00:00Z
  const activity = await prisma.activity.create({
    data: {
      type: "CALL",
      leadId: lead.id,
      body: "โทรติดตามผลหลังดูห้อง",
      nextFollowUpAt: new Date("2026-11-10T08:00:00.000Z"),
      createdById: agent.id,
    },
  });

  // สัญญาเช่าหมดอายุวันที่ 2027-02-08 (อีก 90 วันนับจาก 2026-11-10)
  const contract = await prisma.contract.create({
    data: {
      contractNo: `LS-2026-7${String(sfx).slice(-3)}`,
      assetId: asset.id,
      leadId: lead.id,
      ownerId: owner.id,
      monthlyRent: "20000.00",
      securityDeposit: "40000.00",
      advanceRent: "20000.00",
      startDate: new Date("2026-02-08T00:00:00.000Z"),
      endDate: new Date("2027-02-08T00:00:00.000Z"),
      status: "ACTIVE",
      reminderDays: [90, 60, 30],
    },
  });

  // ค่านายหน้าที่ถึงกำหนดรับจากเจ้าของ + รายการรออนุมัติ
  const commission = await prisma.commission.create({
    data: {
      contractId: contract.id,
      assetId: asset.id,
      ownershipType: "AGENT",
      formula: "ONE_MONTH",
      baseAmount: "20000.00",
      totalAmount: "20000.00",
      status: "AWAITING_OWNER_PAYMENT",
      ownerPaymentDueAt: new Date("2026-11-10T00:00:00.000Z"),
    },
  });

  await prisma.booking.create({
    data: {
      code: `BK-17-${sfx}`,
      leadId: lead.id,
      assetId: asset.id,
      monthlyRent: "20000.00",
      bookingFee: "5000.00",
      startDate: new Date("2027-03-01T00:00:00.000Z"),
      endDate: new Date("2028-02-28T00:00:00.000Z"),
      status: "PENDING_PAYMENT",
    },
  });

  return {
    sfx,
    team,
    admin,
    mgr,
    agent,
    coordinator,
    accounting,
    adminToken,
    mgrToken,
    agentToken,
    coordToken,
    accToken,
    lead,
    appointment,
    activity,
    contract,
    commission,
  };
}
