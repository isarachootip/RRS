import "reflect-metadata";
import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { setupApp } from "../src/setup-app";

const prismaMock = {
  $queryRaw: vi.fn(),
  $connect: vi.fn(),
  $disconnect: vi.fn(),
  onModuleInit: vi.fn(),
  onModuleDestroy: vi.fn(),
};

let app: INestApplication;

beforeAll(async () => {
  process.env.DATABASE_URL ??= "postgresql://test@localhost:5432/unused";
  process.env.NODE_ENV = "test";
  process.env.LOG_LEVEL = "error";
  const mod = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue(prismaMock)
    .compile();
  app = setupApp(mod.createNestApplication());
  await app.init();
});

afterAll(async () => {
  await app?.close();
});

describe("GET /health", () => {
  it("ฐานข้อมูลตอบ → 200 ok", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([{ "?column?": 1 }]);
    const res = await request(app.getHttpServer()).get("/health").expect(200);
    expect(res.body).toMatchObject({ status: "ok", database: "up" });
    expect(res.headers["x-request-id"]).toBeTruthy();
  });

  it("ฐานข้อมูลล่ม → 503 พร้อมข้อความภาษาไทยและรูปแบบ error มาตรฐาน", async () => {
    prismaMock.$queryRaw.mockRejectedValueOnce(new Error("connection refused"));
    const res = await request(app.getHttpServer()).get("/health").set("x-request-id", "req-123").expect(503);
    expect(res.body).toEqual({
      statusCode: 503,
      code: "DATABASE_UNAVAILABLE",
      message: "เชื่อมต่อฐานข้อมูลไม่ได้",
      path: "/health",
      requestId: "req-123",
    });
  });
});

describe("ระบบ", () => {
  it("เส้นทางที่ไม่มี → 404 รูปแบบ error มาตรฐาน", async () => {
    const res = await request(app.getHttpServer()).get("/api/v1/nope").expect(404);
    expect(res.body).toMatchObject({ statusCode: 404, code: "NOT_FOUND", path: "/api/v1/nope" });
  });

  it("Swagger เปิดที่ /docs", async () => {
    const res = await request(app.getHttpServer()).get("/docs-json").expect(200);
    expect(res.body.info.title).toBe("RRS API");
    expect(Object.keys(res.body.paths)).toContain("/health");
  });
});
