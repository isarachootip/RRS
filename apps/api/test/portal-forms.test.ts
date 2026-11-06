import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resetPublicRateLimitBuckets } from "../src/listings/public-listings.controller";
import { MailService } from "../src/mail/mail.service";
import type { PrismaService } from "../src/prisma/prisma.service";
import { createTestApp, createUser, resetRoleCache } from "./helpers";
import { loginGetToken } from "./notifications.fixture";

describe("P22 Public Portal Forms → CRM (Lead dedup, Viewing Appointment, Owner NEW, PDPA & Anti-spam)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let mail: MailService;
  let managerToken: string;
  let agentToken: string;
  let assetId: string;
  let listingId: string;
  let customerPhoneRaw: string;

  beforeAll(async () => {
    resetRoleCache();
    resetPublicRateLimitBuckets();
    const ctx = await createTestApp();
    app = ctx.app;
    prisma = ctx.prisma;
    mail = app.get(MailService);

    const sfx = Date.now();
    customerPhoneRaw = `081${String(sfx).slice(-7)}`;
    const team = await prisma.team.create({ data: { name: `ทีม P22 ${sfx}` } });
    const managerEmail = `manager.p22.${sfx}@test.local`;
    const agentEmail = `agent.p22.${sfx}@test.local`;
    await createUser(app, { email: managerEmail, role: "MANAGER", teamId: team.id });
    await createUser(app, { email: agentEmail, role: "AGENT", teamId: team.id });
    managerToken = await loginGetToken(app, managerEmail);
    agentToken = await loginGetToken(app, agentEmail);

    const ownerRes = await request(app.getHttpServer())
      .post("/api/v1/owners")
      .set("Authorization", `Bearer ${agentToken}`)
      .send({ fullName: "เจ้าของประกาศ P22", phone: `0898${String(sfx).slice(-6)}` })
      .expect(201);

    const assetRes = await request(app.getHttpServer())
      .post("/api/v1/assets")
      .set("Authorization", `Bearer ${agentToken}`)
      .send({
        category: "CONDO",
        ownershipType: "AGENT",
        ownerId: ownerRes.body.id,
        floor: 15,
        district: "คลองเตย",
        province: "กรุงเทพมหานคร",
        areaSqm: 45,
        rentPrice: 28000,
        attributes: { parkingSlots: 1 },
      })
      .expect(201);
    assetId = assetRes.body.id;

    const listingRes = await request(app.getHttpServer())
      .post("/api/v1/listings")
      .set("Authorization", `Bearer ${agentToken}`)
      .send({
        assetId,
        type: "RENT",
        price: 28000,
        titleTh: "คอนโดสุขุมวิท 24 ใกล้ BTS พร้อมพงษ์",
        submitForApproval: true,
      })
      .expect(201);
    listingId = listingRes.body.id;

    await request(app.getHttpServer())
      .post(`/api/v1/listings/${listingId}/approve`)
      .set("Authorization", `Bearer ${managerToken}`)
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });

  it("บล็อกคำขอที่ไม่ติ๊ก PDPA, มี Honeypot, หรือ CAPTCHA ไม่ผ่าน", async () => {
    const noConsent = await request(app.getHttpServer())
      .post("/api/v1/public/inquiries")
      .send({ listingId, fullName: "ลูกค้า ไม่ยินยอม", phone: customerPhoneRaw, pdpaConsent: false })
      .expect(400);
    expect(noConsent.body.code).toBe("PDPA_CONSENT_REQUIRED");

    const honeypot = await request(app.getHttpServer())
      .post("/api/v1/public/inquiries")
      .send({
        listingId,
        fullName: "บอท สแปม",
        phone: customerPhoneRaw,
        pdpaConsent: true,
        websiteUrl: "https://spam.bot",
      })
      .expect(400);
    expect(honeypot.body.code).toBe("SPAM_DETECTED");

    const badCaptcha = await request(app.getHttpServer())
      .post("/api/v1/public/inquiries")
      .send({
        listingId,
        fullName: "บอท แคปช่า",
        phone: customerPhoneRaw,
        pdpaConsent: true,
        turnstileToken: "INVALID_TURNSTILE",
      })
      .expect(400);
    expect(badCaptcha.body.code).toBe("CAPTCHA_FAILED");
  });

  it("ส่งฟอร์มสอบถาม → สร้าง Lead (source=WEBSITE) + บันทึก PDPA + แจ้งเตือน + อีเมลยืนยัน และส่งขอนัดด้วยเบอร์เดิมไม่สร้าง Lead ซ้ำ", async () => {
    const outboxBefore = mail.outbox.length;

    const inqRes = await request(app.getHttpServer())
      .post("/api/v1/public/inquiries")
      .send({
        listingId,
        fullName: "คุณพิมพ์ใจ ลูกค้าจากเว็บ",
        phone: customerPhoneRaw,
        email: "pimjai@example.com",
        message: "สนใจเช่าห้องนี้ เข้าอยู่เดือนหน้า",
        pdpaConsent: true,
        consentVersion: "1.0",
      })
      .expect(201);

    expect(inqRes.body.isExistingLead).toBe(false);
    expect(inqRes.body.consentRecorded).toBe(true);
    const firstLeadId = inqRes.body.leadId as string;

    const leadInDb = await prisma.lead.findUniqueOrThrow({ where: { id: firstLeadId } });
    expect(leadInDb.source).toBe("WEBSITE");
    expect(leadInDb.sourceListingId).toBe(listingId);
    expect(leadInDb.consentAt).not.toBeNull();
    expect(leadInDb.consentText).toContain("WEBSITE");
    expect(mail.outbox.length).toBeGreaterThan(outboxBefore);

    // ส่งฟอร์มขอนัดดูด้วยเบอร์เดิม (+66...) ต้องไม่สร้าง Lead ใหม่ แต่สร้าง Appointment สถานะ PENDING
    const formattedPhone = `+66${customerPhoneRaw.slice(1)}`;
    const viewRes = await request(app.getHttpServer())
      .post("/api/v1/public/viewing-requests")
      .send({
        listingId,
        fullName: "คุณพิมพ์ใจ ลูกค้าจากเว็บ",
        phone: formattedPhone,
        preferredStartAt: "2027-01-15T10:00:00.000Z",
        note: "ขอดูห้องช่วงเช้า",
        pdpaConsent: true,
      })
      .expect(201);

    expect(viewRes.body.isExistingLead).toBe(true);
    expect(viewRes.body.leadId).toBe(firstLeadId);
    expect(viewRes.body.appointmentStatus).toBe("PENDING");

    const activities = await prisma.activity.findMany({ where: { leadId: firstLeadId } });
    expect(activities.length).toBe(2);
  });

  it("ฟอร์มฝากขาย/ฝากเช่า → สร้าง Owner สถานะ NEW (D22) และบันทึกการกดปุ่ม LINE พร้อม UTM", async () => {
    const ownerSubRes = await request(app.getHttpServer())
      .post("/api/v1/public/owner-submissions")
      .send({
        fullName: "คุณวิชัย เจ้าของฝากขาย",
        phone: "0891112233",
        email: "wichai@example.com",
        transactionType: "SALE",
        category: "HOUSE",
        projectName: "หมู่บ้านลากูน วิลล์",
        expectedPrice: 8900000,
        photoUrls: ["https://cdn.rrs.co.th/uploads/house-1.webp"],
        pdpaConsent: true,
      })
      .expect(201);

    expect(ownerSubRes.body.status).toBe("NEW");
    const ownerInDb = await prisma.owner.findUniqueOrThrow({ where: { id: ownerSubRes.body.ownerId } });
    expect(ownerInDb.sourceChannel).toBe("WEBSITE");
    expect(ownerInDb.status).toBe("NEW");

    const clickRes = await request(app.getHttpServer())
      .post("/api/v1/public/click-events")
      .send({ listingId, channel: "LINE", utmSource: "portal", utmCampaign: "condo-sukhumvit" })
      .expect(200);
    expect(clickRes.body.recorded).toBe(true);
    expect(clickRes.body.targetUrl).toContain("line.me");
  });
});
