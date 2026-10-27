import type { INestApplication } from "@nestjs/common";
import { Prisma } from "@rrs/db";
import sharp from "sharp";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { S3StorageService } from "../src/files/s3-storage.service";
import type { PrismaService } from "../src/prisma/prisma.service";
import { PASSWORD, createTestApp, createUser, resetRoleCache } from "./helpers";

let app: INestApplication;
let prisma: PrismaService;
const http = () => request(app.getHttpServer());
const auth = (token: string) => ({ authorization: `Bearer ${token}` });

let agentToken = "";
let agentId = "";
let assetId = "";

beforeAll(async () => {
  resetRoleCache();
  ({ app, prisma } = await createTestApp());

  const team = await prisma.team.create({ data: { name: "ทีมทดสอบ P05" } });
  const agent = await createUser(app, { email: "agent.p05@test.local", role: "AGENT", teamId: team.id });
  agentId = agent.id;

  const loginRes = await http()
    .post("/api/v1/auth/login")
    .send({ email: "agent.p05@test.local", password: PASSWORD })
    .expect(200);
  agentToken = loginRes.body.accessToken as string;

  const owner = await prisma.owner.create({
    data: { code: "OW-000501", fullName: "เจ้าของ P05", phone: "+66811115555", agentId: agent.id },
  });
  const asset = await prisma.asset.create({
    data: {
      code: "PR-000501",
      category: "CONDO",
      ownershipType: "AGENT",
      ownerId: owner.id,
      rentPrice: new Prisma.Decimal("25000.00"),
      primaryAgentId: agent.id,
      internalNote: "หมายเหตุเริ่มต้น",
      agents: { create: [{ userId: agent.id, role: "LISTING" }] },
    },
  });
  assetId = asset.id;
});

afterAll(async () => {
  await app?.close();
});

describe("AuditService อัตโนมัติ (Prisma Extension + AsyncLocalStorage) และ Immutability", () => {
  it("แก้ไข asset ผ่าน API → บันทึก audit_logs อัตโนมัติพร้อม actor, IP และ before/after diff", async () => {
    await http()
      .patch(`/api/v1/assets/${assetId}`)
      .set(auth(agentToken))
      .send({ internalNote: "หมายเหตุหลังแก้ไขครั้งที่ 1" })
      .expect(200);

    const logs = await prisma.auditLog.findMany({
      where: { entityType: "asset", entityId: assetId, action: "UPDATE" },
      orderBy: { createdAt: "desc" },
    });
    expect(logs.length).toBeGreaterThanOrEqual(1);
    const latest = logs[0]!;
    expect(latest.actorId).toBe(agentId);
    expect(latest.before).toMatchObject({ internalNote: "หมายเหตุเริ่มต้น" });
    expect(latest.after).toMatchObject({ internalNote: "หมายเหตุหลังแก้ไขครั้งที่ 1" });

    // ดึงผ่าน GET /api/v1/audit-logs สำหรับ <Timeline />
    const res = await http()
      .get(`/api/v1/audit-logs?entityType=asset&entityId=${assetId}`)
      .set(auth(agentToken))
      .expect(200);
    expect(res.body.items.length).toBeGreaterThanOrEqual(1);
    expect(res.body.items[0]).toMatchObject({
      entityType: "asset",
      entityId: assetId,
      action: "UPDATE",
      actorId: agentId,
    });
  });

  it("UPDATE หรือ DELETE ตาราง audit_logs ตรงๆ ถูกฐานข้อมูลปฏิเสธ", async () => {
    const row = await prisma.auditLog.findFirstOrThrow({ where: { entityId: assetId } });
    await expect(
      prisma.$executeRawUnsafe(`UPDATE audit_logs SET action = 'CREATE' WHERE id = ${row.id.toString()}`),
    ).rejects.toThrow();
    await expect(prisma.$executeRawUnsafe(`DELETE FROM audit_logs WHERE id = ${row.id.toString()}`)).rejects.toThrow();
  });
});

describe("FileService (S3/MinIO, จำกัดชนิด/ขนาด, ย่อรูป 3 ขนาด, signed URL 5 นาที)", () => {
  it("อัปโหลด PDF 2MB สำเร็จ และขอ signed URL ที่หมดอายุใน 5 นาที (300 วินาที) ได้", async () => {
    const pdfHeader = Buffer.from("%PDF-1.4\n");
    const pdfBody = Buffer.alloc(2 * 1024 * 1024 - pdfHeader.length, 0x20);
    const pdfBuffer = Buffer.concat([pdfHeader, pdfBody]);

    const uploadRes = await http()
      .post("/api/v1/files")
      .set(auth(agentToken))
      .field("entityType", "asset")
      .field("entityId", assetId)
      .attach("file", pdfBuffer, { filename: "contract-2mb.pdf", contentType: "application/pdf" })
      .expect(201);

    expect(uploadRes.body).toMatchObject({
      originalName: "contract-2mb.pdf",
      mimeType: "application/pdf",
      sizeBytes: 2 * 1024 * 1024,
      entityType: "asset",
      entityId: assetId,
    });

    const urlRes = await http()
      .get(`/api/v1/files/${uploadRes.body.id as string}/url`)
      .set(auth(agentToken))
      .expect(200);
    expect(urlRes.body.expiresIn).toBe(300);
    expect(urlRes.body.url).toContain("X-Amz-Expires=300");
  });

  it("อัปโหลดรูปภาพ PNG สำเร็จ และสร้างไฟล์ย่อ 3 ขนาด (thumb, medium, large)", async () => {
    const s3 = app.get(S3StorageService);
    const pngBuffer = await sharp({
      create: { width: 1800, height: 1200, channels: 3, background: { r: 20, g: 120, b: 140 } },
    })
      .png()
      .toBuffer();

    const uploadRes = await http()
      .post("/api/v1/files")
      .set(auth(agentToken))
      .field("entityType", "asset")
      .field("entityId", assetId)
      .attach("file", pngBuffer, { filename: "room-photo.png", contentType: "image/png" })
      .expect(201);

    expect(uploadRes.body.variants).toEqual(["thumb", "medium", "large"]);
    const baseKey = uploadRes.body.storageKey as string;
    for (const size of ["thumb", "medium", "large"]) {
      expect(s3.hasStoredKey(`${baseKey}.${size}.webp`)).toBe(true);
    }

    const urlRes = await http()
      .get(`/api/v1/files/${uploadRes.body.id as string}/url`)
      .set(auth(agentToken))
      .expect(200);
    expect(urlRes.body.variants.thumb).toContain("X-Amz-Expires=300");
    expect(urlRes.body.variants.medium).toContain("X-Amz-Expires=300");
    expect(urlRes.body.variants.large).toContain("X-Amz-Expires=300");
  });

  it("ปฏิเสธไฟล์ .exe หรือชนิดที่ไม่อนุญาต (400)", async () => {
    const exeBuf = Buffer.from("MZ-fake-executable");
    const res = await http()
      .post("/api/v1/files")
      .set(auth(agentToken))
      .field("entityType", "asset")
      .field("entityId", assetId)
      .attach("file", exeBuf, { filename: "malware.exe", contentType: "application/x-msdownload" })
      .expect(400);
    expect(res.body.code).toBe("INVALID_FILE_TYPE");
  });

  it("Archive ไฟล์ได้และบันทึก audit action ARCHIVE", async () => {
    const pdfBuffer = Buffer.from("%PDF-1.4\nminimal");
    const uploadRes = await http()
      .post("/api/v1/files")
      .set(auth(agentToken))
      .field("entityType", "asset")
      .field("entityId", assetId)
      .attach("file", pdfBuffer, { filename: "to-archive.pdf", contentType: "application/pdf" })
      .expect(201);

    const fileId = uploadRes.body.id as string;
    await http().post(`/api/v1/files/${fileId}/archive`).set(auth(agentToken)).expect(200);

    const archived = await prisma.file.findUniqueOrThrow({ where: { id: fileId } });
    expect(archived.archivedAt).not.toBeNull();

    const archiveLog = await prisma.auditLog.findFirst({
      where: { entityType: "file", entityId: fileId, action: "ARCHIVE" },
    });
    expect(archiveLog).not.toBeNull();
  });
});
