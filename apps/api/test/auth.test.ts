import type { INestApplication } from "@nestjs/common";
import { authenticator } from "otplib";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MailService } from "../src/mail/mail.service";
import type { PrismaService } from "../src/prisma/prisma.service";
import { PASSWORD, createTestApp, createUser, refreshCookie, resetRoleCache } from "./helpers";

let app: INestApplication;
let prisma: PrismaService;
const http = () => request(app.getHttpServer());

beforeAll(async () => {
  resetRoleCache();
  ({ app, prisma } = await createTestApp());
});
afterAll(async () => {
  await app?.close();
});

const login = (email: string, password = PASSWORD) => http().post("/api/v1/auth/login").send({ email, password });

describe("ล็อกอินด้วยรหัสผ่าน", () => {
  it("สำเร็จ → access token + refresh cookie แบบ httpOnly และเรียก /me ได้", async () => {
    await createUser(app, { email: "agent.ok@test.local" });
    const res = await login("Agent.OK@test.local").expect(200);
    expect(res.body.status).toBe("OK");
    expect(res.body.user).toMatchObject({ email: "agent.ok@test.local", roles: ["AGENT"], mfaRequired: false });
    const cookie = (res.headers["set-cookie"] as unknown as string[]).find((c) => c.startsWith("rrs_refresh="))!;
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Path=\/api\/v1\/auth/);
    expect(cookie).toMatch(/SameSite=Lax/);

    const me = await http().get("/api/v1/auth/me").set("authorization", `Bearer ${res.body.accessToken}`).expect(200);
    expect(me.body.email).toBe("agent.ok@test.local");
  });

  it("ไม่มี token หรือ token ปลอม → 401", async () => {
    await http().get("/api/v1/auth/me").expect(401);
    const res = await http().get("/api/v1/auth/me").set("authorization", "Bearer abc.def.ghi").expect(401);
    expect(res.body).toMatchObject({ code: "UNAUTHENTICATED", message: "กรุณาเข้าสู่ระบบ" });
  });

  it("รหัสผิด กับอีเมลที่ไม่มี → ข้อความเดียวกัน (ไม่บอกว่ามีอีเมลนี้)", async () => {
    await createUser(app, { email: "agent.wrong@test.local" });
    const a = await login("agent.wrong@test.local", "nope-nope-1").expect(401);
    const b = await login("nobody@test.local", "nope-nope-1").expect(401);
    expect(a.body.message).toBe(b.body.message);
    expect(a.body.code).toBe("INVALID_CREDENTIALS");
  });

  it("ข้อมูลไม่ครบ → 400 พร้อมข้อความไทย", async () => {
    const res = await http().post("/api/v1/auth/login").send({ email: "not-an-email" }).expect(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("บัญชีที่ถูกปิด → 403", async () => {
    await createUser(app, { email: "agent.off@test.local", isActive: false });
    const res = await login("agent.off@test.local").expect(403);
    expect(res.body.code).toBe("ACCOUNT_DISABLED");
  });

  it("บันทึก audit ทั้งล็อกอินสำเร็จและไม่สำเร็จ", async () => {
    expect(await prisma.auditLog.count({ where: { action: "LOGIN" } })).toBeGreaterThan(0);
    expect(await prisma.auditLog.count({ where: { action: "LOGIN_FAILED" } })).toBeGreaterThan(0);
  });
});

describe("ล็อกบัญชีหลังผิด 5 ครั้ง", () => {
  it("ครั้งที่ 5 → 423, ใส่รหัสถูกระหว่างล็อกก็ยังเข้าไม่ได้, พ้นเวลาแล้วเข้าได้", async () => {
    const u = await createUser(app, { email: "agent.lock@test.local" });
    for (let i = 0; i < 4; i++) await login(u.email, "wrong-pass-1").expect(401);
    const locked = await login(u.email, "wrong-pass-1").expect(423);
    expect(locked.body.code).toBe("ACCOUNT_LOCKED");
    expect(locked.body.details.lockedUntil).toBeTruthy();
    expect(locked.body.message).toMatch(/ล็อกชั่วคราว/);

    await login(u.email).expect(423);

    await prisma.user.update({ where: { id: u.id }, data: { lockedUntil: new Date(Date.now() - 1000) } });
    await login(u.email).expect(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).failedLoginCount).toBe(0);
  });
});

describe("refresh token แบบหมุนเวียน", () => {
  it("refresh ได้ cookie ใหม่ทุกครั้ง และ access token ใหม่ใช้งานได้", async () => {
    const u = await createUser(app, { email: "agent.refresh@test.local" });
    const c1 = refreshCookie((await login(u.email)).headers["set-cookie"]);
    const r = await http().post("/api/v1/auth/refresh").set("cookie", `rrs_refresh=${c1}`).expect(200);
    const c2 = refreshCookie(r.headers["set-cookie"]);
    expect(c2).toBeTruthy();
    expect(c2).not.toBe(c1);
    await http().get("/api/v1/auth/me").set("authorization", `Bearer ${r.body.accessToken}`).expect(200);
  });

  it("ใช้ cookie เก่าซ้ำหลังหมุนไปแล้ว → 401 และเพิกถอน cookie ใหม่ด้วย (กันขโมย token)", async () => {
    const u = await createUser(app, { email: "agent.reuse@test.local" });
    const c1 = refreshCookie((await login(u.email)).headers["set-cookie"]);
    const c2 = refreshCookie(
      (await http().post("/api/v1/auth/refresh").set("cookie", `rrs_refresh=${c1}`).expect(200)).headers["set-cookie"],
    );
    // จำลองว่าผ่านช่วง grace 10 วินาทีไปแล้ว
    await prisma.refreshToken.updateMany({
      where: { userId: u.id, revokedAt: { not: null } },
      data: { revokedAt: new Date(Date.now() - 60_000) },
    });

    await http().post("/api/v1/auth/refresh").set("cookie", `rrs_refresh=${c1}`).expect(401);
    const res = await http().post("/api/v1/auth/refresh").set("cookie", `rrs_refresh=${c2}`).expect(401);
    expect(res.body.code).toBe("SESSION_EXPIRED");
  });

  it("หมุนพร้อมกัน 2 คำขอด้วย cookie เดียวกัน → สำเร็จ 1 และ family ไม่ถูกเพิกถอน", async () => {
    const u = await createUser(app, { email: "agent.race@test.local" });
    const c1 = refreshCookie((await login(u.email)).headers["set-cookie"]);
    const [a, b] = await Promise.all([
      http().post("/api/v1/auth/refresh").set("cookie", `rrs_refresh=${c1}`),
      http().post("/api/v1/auth/refresh").set("cookie", `rrs_refresh=${c1}`),
    ]);
    const ok = [a, b].filter((r) => r.status === 200);
    expect(ok).toHaveLength(1);
    const winner = refreshCookie(ok[0]!.headers["set-cookie"]);
    await http().post("/api/v1/auth/refresh").set("cookie", `rrs_refresh=${winner}`).expect(200);
  });

  it("ไม่มี cookie → 401", async () => {
    await http().post("/api/v1/auth/refresh").expect(401);
  });
});

describe("ออกจากระบบ", () => {
  it("logout เพิกถอน cookie เครื่องนี้", async () => {
    const u = await createUser(app, { email: "agent.logout@test.local" });
    const c = refreshCookie((await login(u.email)).headers["set-cookie"]);
    await http().post("/api/v1/auth/logout").set("cookie", `rrs_refresh=${c}`).expect(200);
    await http().post("/api/v1/auth/refresh").set("cookie", `rrs_refresh=${c}`).expect(401);
  });

  it("logout-all เพิกถอนทุกอุปกรณ์", async () => {
    const u = await createUser(app, { email: "agent.all@test.local" });
    const d1 = await login(u.email);
    const d2 = refreshCookie((await login(u.email)).headers["set-cookie"]);
    await http().post("/api/v1/auth/logout-all").set("authorization", `Bearer ${d1.body.accessToken}`).expect(200);
    await http().post("/api/v1/auth/refresh").set("cookie", `rrs_refresh=${d2}`).expect(401);
  });
});

describe("2FA (TOTP)", () => {
  it("Admin ล็อกอินครั้งแรก → บังคับตั้ง 2FA, ตั้งแล้วครั้งต่อไปต้องใส่รหัส", async () => {
    const u = await createUser(app, { email: "admin.mfa@test.local", role: "ADMIN" });
    const first = await login(u.email).expect(200);
    expect(first.body).toEqual({ status: "MFA_SETUP_REQUIRED", challengeToken: expect.any(String) });
    expect(first.headers["set-cookie"]).toBeUndefined();

    const setup = await http()
      .post("/api/v1/auth/mfa/setup")
      .send({ challengeToken: first.body.challengeToken })
      .expect(200);
    expect(setup.body.otpauthUrl).toMatch(/^otpauth:\/\/totp\/RRS:admin\.mfa%40test\.local\?/);
    expect(setup.body.qrDataUrl).toMatch(/^data:image\/png;base64,/);
    // secret เก็บแบบเข้ารหัส ไม่ใช่ข้อความเดิม
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(stored.totpSecret).not.toContain(setup.body.secret);

    await http()
      .post("/api/v1/auth/mfa/enable")
      .send({ challengeToken: first.body.challengeToken, code: "000000" })
      .expect(401);
    const enabled = await http()
      .post("/api/v1/auth/mfa/enable")
      .send({ challengeToken: first.body.challengeToken, code: authenticator.generate(setup.body.secret) })
      .expect(200);
    expect(enabled.body.status).toBe("OK");
    expect(refreshCookie(enabled.headers["set-cookie"])).toBeTruthy();

    const second = await login(u.email).expect(200);
    expect(second.body.status).toBe("MFA_REQUIRED");
    await http()
      .post("/api/v1/auth/mfa/verify")
      .send({ challengeToken: second.body.challengeToken, code: "123456" })
      .expect(401);
    const ok = await http()
      .post("/api/v1/auth/mfa/verify")
      .send({ challengeToken: second.body.challengeToken, code: authenticator.generate(setup.body.secret) })
      .expect(200);
    expect(ok.body.user.totpEnabled).toBe(true);
  });

  it("Accounting ก็ถูกบังคับเหมือนกัน แต่ Agent ไม่ถูกบังคับ", async () => {
    await createUser(app, { email: "acc.mfa@test.local", role: "ACCOUNTING" });
    expect((await login("acc.mfa@test.local")).body.status).toBe("MFA_SETUP_REQUIRED");
  });

  it("challenge token ใช้แทน access token ไม่ได้ และ token ปลอมใช้ไม่ได้", async () => {
    await createUser(app, { email: "admin.ch@test.local", role: "ADMIN" });
    const { challengeToken } = (await login("admin.ch@test.local")).body;
    await http().get("/api/v1/auth/me").set("authorization", `Bearer ${challengeToken}`).expect(401);
    const res = await http().post("/api/v1/auth/mfa/setup").send({ challengeToken: "x.y.z" }).expect(401);
    expect(res.body.code).toBe("CHALLENGE_EXPIRED");
  });

  it("Agent เปิด 2FA เองจากโปรไฟล์ได้", async () => {
    const u = await createUser(app, { email: "agent.mfa@test.local" });
    const token = (await login(u.email)).body.accessToken;
    const setup = await http().post("/api/v1/auth/me/mfa/setup").set("authorization", `Bearer ${token}`).expect(200);
    await http()
      .post("/api/v1/auth/me/mfa/enable")
      .set("authorization", `Bearer ${token}`)
      .send({ code: authenticator.generate(setup.body.secret) })
      .expect(200);
    expect((await login(u.email)).body.status).toBe("MFA_REQUIRED");
  });
});

describe("ลืมรหัสผ่าน", () => {
  it("ส่งลิงก์ทางอีเมล, ตั้งรหัสใหม่ได้ครั้งเดียว, เซสชันเดิมถูกเพิกถอน", async () => {
    const mail = app.get(MailService);
    const u = await createUser(app, { email: "agent.reset@test.local" });
    const oldCookie = refreshCookie((await login(u.email)).headers["set-cookie"]);

    const res = await http().post("/api/v1/auth/password/forgot").send({ email: u.email }).expect(200);
    expect(res.body.message).toMatch(/ถ้ามีบัญชีนี้/);
    const msg = mail.outbox.at(-1)!;
    expect(msg.to).toBe(u.email);
    const token = /token=([\w-]+)/.exec(msg.text)![1]!;

    const weak = await http().post("/api/v1/auth/password/reset").send({ token, password: "short" }).expect(400);
    expect(weak.body.code).toBe("WEAK_PASSWORD");

    await http().post("/api/v1/auth/password/reset").send({ token, password: "Brand-new-pass-77" }).expect(200);
    const again = await http()
      .post("/api/v1/auth/password/reset")
      .send({ token, password: "Another-pass-88" })
      .expect(400);
    expect(again.body.code).toBe("RESET_LINK_INVALID");

    await http().post("/api/v1/auth/refresh").set("cookie", `rrs_refresh=${oldCookie}`).expect(401);
    await login(u.email).expect(401);
    await login(u.email, "Brand-new-pass-77").expect(200);
  });

  it("อีเมลที่ไม่มีในระบบ → ตอบเหมือนกันและไม่ส่งอีเมล", async () => {
    const mail = app.get(MailService);
    const before = mail.outbox.length;
    const res = await http().post("/api/v1/auth/password/forgot").send({ email: "ghost@test.local" }).expect(200);
    expect(res.body.message).toMatch(/ถ้ามีบัญชีนี้/);
    expect(mail.outbox.length).toBe(before);
  });

  it("ลิงก์หมดอายุ → ใช้ไม่ได้", async () => {
    const mail = app.get(MailService);
    const u = await createUser(app, { email: "agent.expired@test.local" });
    await http().post("/api/v1/auth/password/forgot").send({ email: u.email }).expect(200);
    const token = /token=([\w-]+)/.exec(mail.outbox.at(-1)!.text)![1]!;
    await prisma.passwordResetToken.updateMany({
      where: { userId: u.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await http().post("/api/v1/auth/password/reset").send({ token, password: "Brand-new-pass-77" }).expect(400);
  });

  it("ปลดล็อกบัญชีเมื่อตั้งรหัสใหม่", async () => {
    const mail = app.get(MailService);
    const u = await createUser(app, { email: "agent.unlock@test.local" });
    await prisma.user.update({ where: { id: u.id }, data: { lockedUntil: new Date(Date.now() + 3_600_000) } });
    await http().post("/api/v1/auth/password/forgot").send({ email: u.email }).expect(200);
    const token = /token=([\w-]+)/.exec(mail.outbox.at(-1)!.text)![1]!;
    await http().post("/api/v1/auth/password/reset").send({ token, password: "Unlocked-pass-11" }).expect(200);
    await login(u.email, "Unlocked-pass-11").expect(200);
  });
});

describe("เปลี่ยนรหัสผ่าน", () => {
  it("ต้องใส่รหัสปัจจุบันถูก และรหัสใหม่ต้องไม่มีชื่ออีเมล", async () => {
    const u = await createUser(app, { email: "somchai@test.local" });
    const token = (await login(u.email)).body.accessToken;
    const auth = { authorization: `Bearer ${token}` };
    await http()
      .post("/api/v1/auth/password/change")
      .set(auth)
      .send({ currentPassword: "wrong", newPassword: "Good-pass-123" })
      .expect(400);
    const r = await http()
      .post("/api/v1/auth/password/change")
      .set(auth)
      .send({ currentPassword: PASSWORD, newPassword: "somchai-2026-x" })
      .expect(400);
    expect(r.body.message).toMatch(/ชื่ออีเมล/);
    await http()
      .post("/api/v1/auth/password/change")
      .set(auth)
      .send({ currentPassword: PASSWORD, newPassword: "Good-pass-123" })
      .expect(200);
    await login(u.email, "Good-pass-123").expect(200);
  });
});
