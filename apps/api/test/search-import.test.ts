import type { INestApplication } from "@nestjs/common";
import { runLegacyImport } from "@rrs/db";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaService } from "../src/prisma/prisma.service";
import { PASSWORD, createTestApp, createUser, resetRoleCache } from "./helpers";

describe("P08 · Global Search (pg_trgm + DataScope) & Legacy CSV Importer", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let mgrToken: string;
  let agentAToken: string;
  let agentBToken: string;
  let projectId: string;
  let ownerAId: string;

  beforeAll(async () => {
    resetRoleCache();
    ({ app, prisma } = await createTestApp());

    const teamA = await prisma.team.create({ data: { name: "ทีม A P08" } });
    const teamB = await prisma.team.create({ data: { name: "ทีม B P08" } });

    await createUser(app, {
      email: "mgr.p08@test.local",
      role: "MANAGER",
      teamId: teamA.id,
    });
    const agentA = await createUser(app, {
      email: "agenta.p08@test.local",
      role: "AGENT",
      teamId: teamA.id,
    });
    await createUser(app, {
      email: "agentb.p08@test.local",
      role: "AGENT",
      teamId: teamB.id,
    });

    const login = async (email: string) => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({ email, password: PASSWORD })
        .expect(200);
      return res.body.accessToken as string;
    };

    mgrToken = await login("mgr.p08@test.local");
    agentAToken = await login("agenta.p08@test.local");
    agentBToken = await login("agentb.p08@test.local");

    const project = await prisma.project.create({
      data: {
        name: "ไอดีโอ คิว สุขุมวิท 36 (P08)",
        nameEn: "Ideo Q Sukhumvit 36 P08",
        district: "คลองเตย",
        province: "กรุงเทพมหานคร",
      },
    });
    projectId = project.id;

    const ownerA = await prisma.owner.create({
      data: {
        code: "OW-800001",
        fullName: "คุณเกรียงไกร ทองหล่อ",
        phone: "+66812349999",
        agentId: agentA.id,
      },
    });
    ownerAId = ownerA.id;

    await prisma.asset.create({
      data: {
        code: "PR-800001",
        category: "CONDO",
        ownershipType: "AGENT",
        ownerId: ownerA.id,
        projectId: project.id,
        unitNo: "24/88",
        rentPrice: 28000,
        primaryAgentId: agentA.id,
        attributes: { floor: 24, roomType: "ONE_BED" },
      },
    });

    await prisma.lead.create({
      data: {
        code: "LD-800001",
        intent: "RENT",
        fullName: "คุณพิมพ์ชนก อโศก",
        phone: "+66897776655",
        source: "LINE",
        ownerAgentId: agentA.id,
        status: "NEW",
      },
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  it("Global search ค้นชื่อ, เบอร์บางส่วน, โครงการ, เลขห้อง ข้าม owners/assets/leads เคารพ data scope ภายใน 300ms", async () => {
    // 1. ค้นด้วยชื่อโครงการ "สุขุมวิท 36" โดย Agent A
    const projectRes = await request(app.getHttpServer())
      .get("/api/v1/search?q=" + encodeURIComponent("สุขุมวิท 36"))
      .set("Authorization", `Bearer ${agentAToken}`)
      .expect(200);

    expect(projectRes.body.tookMs).toBeLessThan(300);
    expect(projectRes.body.assets.some((a: { code: string }) => a.code === "PR-800001")).toBe(true);

    // 2. ค้นด้วยเลขห้อง "24/88"
    const unitRes = await request(app.getHttpServer())
      .get("/api/v1/search?q=" + encodeURIComponent("24/88"))
      .set("Authorization", `Bearer ${agentAToken}`)
      .expect(200);
    expect(unitRes.body.assets.some((a: { unitNo: string }) => a.unitNo === "24/88")).toBe(true);

    // 3. ค้นด้วยเบอร์บางส่วน "081234" เจอเจ้าของทรัพย์ของ Agent A แต่ Agent B ต้องไม่เห็น
    const phoneResA = await request(app.getHttpServer())
      .get("/api/v1/search?q=081234")
      .set("Authorization", `Bearer ${agentAToken}`)
      .expect(200);
    expect(phoneResA.body.owners.some((o: { code: string }) => o.code === "OW-800001")).toBe(true);

    const phoneResB = await request(app.getHttpServer())
      .get("/api/v1/search?q=081234")
      .set("Authorization", `Bearer ${agentBToken}`)
      .expect(200);
    expect(phoneResB.body.owners.some((o: { code: string }) => o.code === "OW-800001")).toBe(false);

    // 4. ค้นด้วยเบอร์บางส่วนของ Lead "089777" โดย Manager ทีม A
    const leadRes = await request(app.getHttpServer())
      .get("/api/v1/search?q=089777")
      .set("Authorization", `Bearer ${mgrToken}`)
      .expect(200);
    expect(leadRes.body.leads.some((l: { code: string }) => l.code === "LD-800001")).toBe(true);
  });

  it("Import CSV โหมด --dry-run ออกรายงานแถวผิดและซ้ำ และเมื่อ import จริงซ้ำรอบสองไม่สร้างแถวซ้ำ (idempotent)", async () => {
    const ownersCsv = [
      "ชื่อ-นามสกุล,เบอร์โทร,LINE ID,อีเมล,ผู้ดูแล",
      "คุณนพดล สุขสวัสดิ์,082-333-4444,@noppadol,noppadol@example.com,agenta.p08@test.local",
      ",082-000-0000,@missingname,invalid@example.com,agenta.p08@test.local",
      "คุณเกรียงไกร ซ้ำเบอร์,081-234-9999,@dup,dup@example.com,agenta.p08@test.local",
    ].join("\n");

    // 1. Dry-run ไม่เขียนลง DB แต่รายงานแถวผิด 1 แถว และแถวซ้ำ 1 แถว
    const dryRunRes = await runLegacyImport(prisma, {
      entity: "owners",
      csvContent: ownersCsv,
      dryRun: true,
    });
    expect(dryRunRes.totalRows).toBe(3);
    expect(dryRunRes.validRows).toBe(1);
    expect(dryRunRes.invalidRows).toBe(1);
    expect(dryRunRes.duplicateRows).toBe(1);
    expect(dryRunRes.importedRows).toBe(0);
    expect(dryRunRes.csvReport).toContain("INVALID");
    expect(dryRunRes.csvReport).toContain("DUPLICATE");

    // 2. Import จริงรอบแรก สร้าง 1 แถว
    const firstImport = await runLegacyImport(prisma, {
      entity: "owners",
      csvContent: ownersCsv,
      dryRun: false,
    });
    expect(firstImport.importedRows).toBe(1);

    // 3. Import ซ้ำรอบสองด้วยไฟล์เดิม → Idempotent (importedRows = 0, duplicateRows = 2)
    const secondImport = await runLegacyImport(prisma, {
      entity: "owners",
      csvContent: ownersCsv,
      dryRun: false,
    });
    expect(secondImport.importedRows).toBe(0);
    expect(secondImport.duplicateRows).toBe(2);

    // 4. ทดสอบ Import Assets พร้อมผูกชื่อโครงการแบบ fuzzy ("ไอดีโอ คิว สุขุมวิท36" → projectId)
    const assetsCsv = [
      "ประเภท,กรรมสิทธิ์,เบอร์เจ้าของ,โครงการ,เลขห้อง,ราคาเช่า,ผู้ดูแล",
      "CONDO,AGENT,0812349999,ไอดีโอ คิว สุขุมวิท36 (P08),99/101,32000,agenta.p08@test.local",
    ].join("\n");

    const assetImport1 = await runLegacyImport(prisma, {
      entity: "assets",
      csvContent: assetsCsv,
      dryRun: false,
    });
    expect(assetImport1.importedRows).toBe(1);

    const importedAsset = await prisma.asset.findFirst({ where: { unitNo: "99/101" } });
    expect(importedAsset?.projectId).toBe(projectId);
    expect(importedAsset?.ownerId).toBe(ownerAId);

    const assetImport2 = await runLegacyImport(prisma, {
      entity: "assets",
      csvContent: assetsCsv,
      dryRun: false,
    });
    expect(assetImport2.importedRows).toBe(0);
    expect(assetImport2.duplicateRows).toBe(1);
  });
});
