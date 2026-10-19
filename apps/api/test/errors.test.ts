import { NotFoundException } from "@nestjs/common";
import { Prisma } from "@rrs/db";
import { describe, expect, it } from "vitest";
import { toErrorBody } from "../src/common/all-exceptions.filter";
import { validateEnv } from "../src/config/env";

const known = (code: string) => new Prisma.PrismaClientKnownRequestError("x", { code, clientVersion: "6.16.2" });

describe("toErrorBody", () => {
  it("จองทับช่วงเวลา → 409 PERIOD_OVERLAP", () => {
    const e = new Error('conflicting key value violates exclusion constraint "bookings_no_overlap"');
    expect(toErrorBody(e, "/x")).toMatchObject({ statusCode: 409, code: "PERIOD_OVERLAP" });
    expect(toErrorBody(new Error("asset_period_overlap: ..."), "/x").code).toBe("PERIOD_OVERLAP");
  });

  it("แก้สัญญาที่มีผลแล้ว → 409 CONTRACT_LOCKED", () => {
    expect(toErrorBody(new Error("contract_locked: ..."), "/x")).toMatchObject({
      statusCode: 409,
      code: "CONTRACT_LOCKED",
    });
  });

  it.each([
    ["P2002", 409, "DUPLICATE"],
    ["P2025", 404, "NOT_FOUND"],
    ["P2003", 400, "INVALID_REFERENCE"],
  ])("Prisma %s → %i %s", (code, status, appCode) => {
    expect(toErrorBody(known(code), "/x")).toMatchObject({ statusCode: status, code: appCode });
  });

  it("HttpException คงสถานะเดิม", () => {
    expect(toErrorBody(new NotFoundException("ไม่พบลูกค้า"), "/x")).toMatchObject({
      statusCode: 404,
      message: "ไม่พบลูกค้า",
    });
  });

  it("error อื่น → 500 ไม่เปิดเผยรายละเอียดภายใน", () => {
    const body = toErrorBody(new Error("secret stack detail"), "/x", "r1");
    expect(body).toMatchObject({ statusCode: 500, code: "INTERNAL_ERROR", requestId: "r1" });
    expect(JSON.stringify(body)).not.toContain("secret");
  });
});

const required = {
  DATABASE_URL: "postgresql://a@b:5432/c",
  JWT_ACCESS_SECRET: "x".repeat(32),
  TOTP_ENCRYPTION_KEY: Buffer.alloc(32).toString("base64"),
};

describe("validateEnv", () => {
  it("ขาด DATABASE_URL → error บอกชื่อตัวแปร", () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL/);
  });
  it("ค่าเริ่มต้น", () => {
    const env = validateEnv(required);
    expect(env.API_PORT).toBe(4000);
    expect(env.SWAGGER_ENABLED).toBe(true);
    expect(env.ACCESS_TOKEN_TTL_SECONDS).toBe(900);
    expect(env.MAIL_TRANSPORT).toBe("log");
  });
  it("secret สั้นเกินไป หรือ key ผิดขนาด → error", () => {
    expect(() => validateEnv({ ...required, JWT_ACCESS_SECRET: "short" })).toThrow(/JWT_ACCESS_SECRET/);
    expect(() => validateEnv({ ...required, TOTP_ENCRYPTION_KEY: "abc" })).toThrow(/TOTP_ENCRYPTION_KEY/);
  });
  it("smtp ต้องมี SMTP_URL", () => {
    expect(() => validateEnv({ ...required, MAIL_TRANSPORT: "smtp" })).toThrow(/SMTP_URL/);
  });
});
