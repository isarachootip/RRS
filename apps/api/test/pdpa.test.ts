import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ANONYMIZED_NAME } from "../src/pdpa/pdpa.types";
import { type PdpaTestCtx, setupPdpaTestSuite } from "./pdpa.fixture";

let ctx: PdpaTestCtx;
const http = () => request(ctx.app.getHttpServer());
const auth = (token: string) => ({ authorization: `Bearer ${token}` });

beforeAll(async () => {
  ctx = await setupPdpaTestSuite();
});

afterAll(async () => {
  await ctx?.app?.close();
});

describe("P24 · PDPA ความยินยอม คำขอดู/แก้ไข/ลบข้อมูล (Anonymize) และ Data Retention 24 เดือน", () => {
  it("1) บันทึกความยินยอม PDPA (รุ่นข้อความ, เวลา, ช่องทาง) และบันทึก VIEW_SENSITIVE เมื่อเปิดดูข้อมูลอ่อนไหว", async () => {
    const consentRes = await http()
      .post("/api/v1/pdpa/consents")
      .set(auth(ctx.agentToken))
      .send({
        subjectType: "LEAD",
        subjectId: ctx.leadWithContractId,
        consentText: "ข้าพเจ้ายินยอมให้บริษัทจัดเก็บและใช้ข้อมูลส่วนบุคคลเพื่อการติดต่อจัดหาที่พักอาศัย",
        version: "1.0",
        channel: "BACKOFFICE",
      })
      .expect(201);

    expect(consentRes.body).toMatchObject({
      subjectType: "LEAD",
      subjectId: ctx.leadWithContractId,
      version: "1.0",
      channel: "BACKOFFICE",
    });

    const viewRes = await http()
      .post("/api/v1/pdpa/view-sensitive")
      .set(auth(ctx.agentToken))
      .send({
        entityType: "lead",
        entityId: ctx.leadWithContractId,
        field: "PHONE_FULL",
      })
      .expect(201);

    expect(viewRes.body.action).toBe("VIEW_SENSITIVE");

    const sensitiveAudit = await ctx.prisma.auditLog.findFirst({
      where: { entityType: "lead", entityId: ctx.leadWithContractId, action: "VIEW_SENSITIVE" },
    });
    expect(sensitiveAudit).not.toBeNull();
  });

  it("2) คำขอเจ้าของข้อมูล (DSR): ส่งออก JSON และ PDF สำเร็จ + แก้ไขข้อมูลส่วนบุคคลได้พร้อม Audit", async () => {
    const jsonRes = await http()
      .get(`/api/v1/pdpa/subjects/LEAD/${ctx.leadWithContractId}/export?format=json`)
      .set(auth(ctx.adminToken))
      .expect(200);

    expect(jsonRes.body.subject.fullName).toBe(ctx.leadOldName);
    expect(jsonRes.body.contracts).toHaveLength(1);

    const pdfRes = await http()
      .get(`/api/v1/pdpa/subjects/LEAD/${ctx.leadWithContractId}/export?format=pdf`)
      .set(auth(ctx.adminToken))
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200);

    expect(pdfRes.headers["content-type"]).toContain("application/pdf");
    const pdfBuf = pdfRes.body as Buffer;
    expect(pdfBuf.subarray(0, 8).toString("utf8")).toContain("%PDF-1.4");

    const rectifyRes = await http()
      .patch(`/api/v1/pdpa/subjects/OWNER/${ctx.ownerId}`)
      .set(auth(ctx.adminToken))
      .send({ email: "owner.rectified@example.com" })
      .expect(200);

    expect(rectifyRes.body.email).toBe("owner.rectified@example.com");
  });

  it("3) Anonymize ลบข้อมูลระบุตัวตน: ค้นหาชื่อ/เบอร์เดิมไม่เจอทั้งในตารางหลักและ audit_logs แต่ยอดในรายงานไม่เปลี่ยน", async () => {
    const dashBefore = await http()
      .get("/api/v1/reports/dashboard?from=2026-01-01&to=2026-12-31")
      .set(auth(ctx.adminToken))
      .expect(200);

    await http()
      .post(`/api/v1/pdpa/subjects/LEAD/${ctx.leadWithContractId}/anonymize`)
      .set(auth(ctx.adminToken))
      .send({ reason: "เจ้าของข้อมูลขอใช้สิทธิ์ลบข้อมูลส่วนบุคคลตาม PDPA" })
      .expect(201);

    // 1. ค้นหาในตารางหลัก (leads, contract_parties, activities) ด้วยชื่อเดิมหรือเบอร์เดิม ต้องไม่เจอ
    const leadMatches = await ctx.prisma.lead.findMany({
      where: {
        OR: [{ fullName: { contains: ctx.leadOldName } }, { phone: { contains: ctx.leadOldPhone } }],
      },
    });
    expect(leadMatches).toHaveLength(0);

    const partyMatches = await ctx.prisma.contractParty.findMany({
      where: {
        OR: [{ fullName: { contains: ctx.leadOldName } }, { phone: { contains: ctx.leadOldPhone } }],
      },
    });
    expect(partyMatches).toHaveLength(0);

    const activityMatches = await ctx.prisma.activity.findMany({
      where: {
        OR: [{ body: { contains: ctx.leadOldName } }, { body: { contains: ctx.leadOldPhone } }],
      },
    });
    expect(activityMatches).toHaveLength(0);

    // 2. ค้นหาในตาราง audit_logs ทั้งหมดว่าไม่มีชื่อเดิมหรือเบอร์เดิมหลงเหลือใน JSON before/after
    const rawAuditMatches = await ctx.prisma.$queryRawUnsafe<Array<{ id: bigint }>>(
      `SELECT id FROM audit_logs WHERE COALESCE(before::text, '') LIKE $1 OR COALESCE(after::text, '') LIKE $1 OR COALESCE(before::text, '') LIKE $2 OR COALESCE(after::text, '') LIKE $2`,
      `%${ctx.leadOldName}%`,
      `%${ctx.leadOldPhone}%`,
    );
    expect(rawAuditMatches).toHaveLength(0);

    // 3. มีระเบียน audit_logs ยืนยันการลบข้อมูล (บันทึกเฉพาะว่ามีการลบ ไม่เก็บค่าเดิม)
    const anonymizeAudit = await ctx.prisma.auditLog.findFirst({
      where: { entityType: "pdpa_anonymize", entityId: ctx.leadWithContractId, action: "ARCHIVE" },
    });
    expect(anonymizeAudit).not.toBeNull();
    expect(anonymizeAudit?.after).toMatchObject({ anonymized: true, subjectType: "LEAD" });

    // 4. ยอดในรายงานและ Dashboard การเงินไม่เปลี่ยนแปลงแม้แต่สตางค์เดียว
    const dashAfter = await http()
      .get("/api/v1/reports/dashboard?from=2026-01-01&to=2026-12-31")
      .set(auth(ctx.adminToken))
      .expect(200);

    expect(dashAfter.body.kpis).toEqual(dashBefore.body.kpis);
  });

  it("4) Job รายเดือนทำ anonymize อัตโนมัติสำหรับ Lead ที่ LOST และไม่มีกิจกรรมครบ 24 เดือน (D19)", async () => {
    const jobRes = await http()
      .post("/api/v1/pdpa/jobs/retention-cleanup")
      .set(auth(ctx.adminToken))
      .send({ retentionMonths: 24, nowIso: "2026-11-06T00:00:00.000Z" })
      .expect(201);

    expect(jobRes.body.anonymizedLeadIds).toContain(ctx.staleLostLeadId);
    expect(jobRes.body.anonymizedLeadIds).not.toContain(ctx.recentLostLeadId);

    const staleAfter = await ctx.prisma.lead.findUniqueOrThrow({ where: { id: ctx.staleLostLeadId } });
    expect(staleAfter.fullName).toBe(ANONYMIZED_NAME);
    expect(staleAfter.phone).toBeNull();

    const recentAfter = await ctx.prisma.lead.findUniqueOrThrow({ where: { id: ctx.recentLostLeadId } });
    expect(recentAfter.fullName).not.toBe(ANONYMIZED_NAME);
  });
});
