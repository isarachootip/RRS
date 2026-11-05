import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MailService } from "../src/mail/mail.service";
import { LineMessagingService } from "../src/notifications/line-messaging.service";
import { NotificationsService } from "../src/notifications/notifications.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { createTestApp } from "./helpers";
import { setupNotificationsFixture } from "./notifications.fixture";

describe("P17 · ระบบแจ้งเตือน (Fake Clock, Idempotency, 3-Attempt Retry, LINE/Email/In-App, Admin Rules)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let notificationsService: NotificationsService;
  let lineService: LineMessagingService;
  let mailService: MailService;
  let fx: Awaited<ReturnType<typeof setupNotificationsFixture>>;

  beforeAll(async () => {
    const created = await createTestApp();
    app = created.app;
    prisma = created.prisma;
    notificationsService = app.get(NotificationsService);
    lineService = app.get(LineMessagingService);
    mailService = app.get(MailService);
    fx = await setupNotificationsFixture(app, prisma);
  });

  afterAll(async () => {
    lineService?.setCustomHandler(undefined);
    await app?.close();
  });

  it("1) Fake Clock: เตือนนัด 1 วัน/2 ชม.ก่อน, ติดตามเลยกำหนด (escalate หา Manager), สัญญาเหลือ 90/60/30 วัน, ค่านายหน้า และสรุปรออนุมัติ ส่งถูกคน ถูกเวลา ไม่ส่งซ้ำ", async () => {
    lineService.outbox.length = 0;
    mailService.outbox.length = 0;

    // 1.1 เวลา 2026-11-09 10:30Z (ก่อนนัด 23.5 ชม. -> เข้าเกณฑ์เตือนล่วงหน้า 1 วัน = 1440 นาที)
    const run1 = await notificationsService.runScheduledChecks(new Date("2026-11-09T10:30:00.000Z"));
    expect(run1.totalSent).toBeGreaterThanOrEqual(2);

    const agentNotifs1 = await prisma.notification.findMany({
      where: { userId: fx.agent.id, event: "appointment.reminder" },
    });
    const coordNotifs1 = await prisma.notification.findMany({
      where: { userId: fx.coordinator.id, event: "appointment.reminder" },
    });
    expect(agentNotifs1).toHaveLength(1);
    expect(agentNotifs1[0]?.dedupeKey).toContain(":1440m:");
    expect(coordNotifs1).toHaveLength(1);
    expect(lineService.outbox.some((m) => m.to === `U_AGENT_${fx.sfx}`)).toBe(true);
    expect(lineService.outbox.some((m) => m.to === `U_COORD_${fx.sfx}`)).toBe(true);

    // รันซ้ำที่เวลา 2026-11-09 10:45Z -> ต้องไม่ส่งซ้ำ (Idempotency)
    const run1Dup = await notificationsService.runScheduledChecks(new Date("2026-11-09T10:45:00.000Z"));
    expect(run1Dup.totalSkippedDuplicate).toBeGreaterThanOrEqual(2);
    expect(await prisma.notification.count({ where: { userId: fx.agent.id, event: "appointment.reminder" } })).toBe(1);

    // 1.2 เลื่อนนาฬิกาไป 2026-11-10 08:30Z (ก่อนนัด 1.5 ชม. = 120m, ถึงกำหนด followup, สัญญาเหลือ 90 วัน, ค่านายหน้า, สรุปรออนุมัติ)
    await notificationsService.runScheduledChecks(new Date("2026-11-10T08:30:00.000Z"));

    const agentAppt2h = await prisma.notification.findMany({
      where: { userId: fx.agent.id, event: "appointment.reminder" },
    });
    expect(agentAppt2h).toHaveLength(2);
    expect(agentAppt2h.some((n) => n.dedupeKey?.includes(":120m:"))).toBe(true);

    expect(await prisma.notification.count({ where: { userId: fx.agent.id, event: "followup.due" } })).toBe(1);
    expect(await prisma.notification.count({ where: { userId: fx.mgr.id, event: "followup.due" } })).toBe(0);

    expect(
      await prisma.notification.findFirst({
        where: { userId: fx.agent.id, event: "contract.expiring", dedupeKey: { contains: ":90d:" } },
      }),
    ).toBeTruthy();
    expect(
      await prisma.notification.findFirst({
        where: { userId: fx.mgr.id, event: "contract.expiring", dedupeKey: { contains: ":90d:" } },
      }),
    ).toBeTruthy();
    expect(
      await prisma.notification.findFirst({ where: { userId: fx.accounting.id, event: "commission.due" } }),
    ).toBeTruthy();
    expect(
      await prisma.notification.findFirst({ where: { userId: fx.mgr.id, event: "approval.pending" } }),
    ).toBeTruthy();

    // 1.3 เลื่อนนาฬิกาไป 2026-11-11 09:00Z (เลยกำหนดติดตามเกิน 1 วัน -> escalate แจ้งเตือน Manager)
    await notificationsService.runScheduledChecks(new Date("2026-11-11T09:00:00.000Z"));
    const mgrFollowUpAfter = await prisma.notification.findMany({
      where: { userId: fx.mgr.id, event: "followup.due" },
    });
    expect(mgrFollowUpAfter).toHaveLength(1);
    expect(mgrFollowUpAfter[0]?.dedupeKey).toContain(":escalate:");

    // 1.4 เลื่อนนาฬิกาไปช่วงสัญญาเหลือ 60 วัน (2026-12-10) และ 30 วัน (2027-01-09)
    await notificationsService.runScheduledChecks(new Date("2026-12-10T09:00:00.000Z"));
    await notificationsService.runScheduledChecks(new Date("2027-01-09T09:00:00.000Z"));

    expect(
      await prisma.notification.findFirst({
        where: { userId: fx.agent.id, event: "contract.expiring", dedupeKey: { contains: ":60d:" } },
      }),
    ).toBeTruthy();
    expect(
      await prisma.notification.findFirst({
        where: { userId: fx.agent.id, event: "contract.expiring", dedupeKey: { contains: ":30d:" } },
      }),
    ).toBeTruthy();
  });

  it("2) Retry 3 ครั้งเมื่อส่งช่องทางภายนอกล้มเหลวชั่วคราว และบันทึกสถานะ failed เมื่อครบ 3 ครั้ง", async () => {
    let attempts = 0;
    lineService.setCustomHandler(async () => {
      attempts++;
      if (attempts < 3) throw new Error("Simulated transient LINE API error");
    });

    await notificationsService.emitEvent({
      event: "lead.assigned",
      title: "มอบหมายลูกค้าใหม่ (ทดสอบ Retry สำเร็จครั้งที่ 3)",
      dedupeBaseKey: `lead.assigned:retry-ok:${fx.sfx}`,
      context: { newOwnerId: fx.agent.id },
    });
    expect(attempts).toBe(3);

    const okNotif = await prisma.notification.findUnique({
      where: { dedupeKey: `lead.assigned:retry-ok:${fx.sfx}:${fx.agent.id}` },
    });
    expect((okNotif?.delivery as Record<string, string>)?.LINE).toBe("sent");

    let failAttempts = 0;
    lineService.setCustomHandler(async () => {
      failAttempts++;
      throw new Error("Persistent LINE API outage");
    });

    await notificationsService.emitEvent({
      event: "lead.assigned",
      title: "มอบหมายลูกค้าใหม่ (ทดสอบ Retry ล้มเหลวครบ 3 ครั้ง)",
      dedupeBaseKey: `lead.assigned:retry-fail:${fx.sfx}`,
      context: { newOwnerId: fx.agent.id },
    });
    expect(failAttempts).toBe(3);

    const failNotif = await prisma.notification.findUnique({
      where: { dedupeKey: `lead.assigned:retry-fail:${fx.sfx}:${fx.agent.id}` },
    });
    expect((failNotif?.delivery as Record<string, string>)?.LINE).toBe("failed");
    lineService.setCustomHandler(undefined);
  });

  it("3) Admin แก้ไข notification_rules ได้ และผู้ใช้ตั้งค่าช่องทางต่อประเภท + อ่านแจ้งเตือนผ่าน API ได้", async () => {
    await request(app.getHttpServer())
      .patch("/api/v1/notifications/rules/lead.created")
      .set("Authorization", `Bearer ${fx.agentToken}`)
      .send({ channels: ["IN_APP", "EMAIL"] })
      .expect(403);

    const ruleRes = await request(app.getHttpServer())
      .patch("/api/v1/notifications/rules/lead.created")
      .set("Authorization", `Bearer ${fx.adminToken}`)
      .send({ channels: ["IN_APP", "EMAIL"] })
      .expect(200);
    expect(ruleRes.body.channels).toEqual(["IN_APP", "EMAIL"]);

    await request(app.getHttpServer())
      .patch("/api/v1/notifications/preferences")
      .set("Authorization", `Bearer ${fx.agentToken}`)
      .send({ preferences: { "appointment.changed": ["IN_APP"] } })
      .expect(200);

    const listRes = await request(app.getHttpServer())
      .get("/api/v1/notifications?unreadOnly=true")
      .set("Authorization", `Bearer ${fx.agentToken}`)
      .expect(200);
    expect(listRes.body.unreadCount).toBeGreaterThan(0);

    await request(app.getHttpServer())
      .post("/api/v1/notifications/read-all")
      .set("Authorization", `Bearer ${fx.agentToken}`)
      .expect(201);

    const afterRead = await request(app.getHttpServer())
      .get("/api/v1/notifications?unreadOnly=true")
      .set("Authorization", `Bearer ${fx.agentToken}`)
      .expect(200);
    expect(afterRead.body.unreadCount).toBe(0);
  });
});
