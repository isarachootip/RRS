import type { INestApplication } from "@nestjs/common";
import { fromSatang, toSatang } from "@rrs/shared";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaService } from "../src/prisma/prisma.service";
import { createTestApp, resetRoleCache } from "./helpers";
import { setupReportsDashboardFixture } from "./reports-dashboard.fixture";

describe("P16 · Dashboard + รายงาน + Export (Reconciliation, Data Scope, Export RBAC & Audit)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let fx: Awaited<ReturnType<typeof setupReportsDashboardFixture>>;

  beforeAll(async () => {
    resetRoleCache();
    ({ app, prisma } = await createTestApp());
    fx = await setupReportsDashboardFixture(app, prisma);
  });

  afterAll(async () => {
    await app?.close();
  });

  it("1) Reconciliation: ยอดบน Dashboard เท่ากับผลรวมรายการธุรกรรมในรายงานทุกตัวกรองตรงทุกสตางค์ และโหลดใน < 2 วินาที", async () => {
    const filterVariations = [
      {},
      { dealType: "RENT", groupBy: "PERIOD", granularity: "MONTH" },
      { dealType: "SALE", groupBy: "PROJECT" },
      { teamId: fx.sukhumvitTeamId, groupBy: "AGENT" },
      { projectId: fx.projAId, groupBy: "OWNERSHIP" },
      { startDate: "2026-01-01", endDate: "2026-12-31", groupBy: "CONTRACT_DEAL" },
    ];

    for (const q of filterVariations) {
      const t0 = Date.now();
      const [dashRes, repRes] = await Promise.all([
        request(app.getHttpServer())
          .get("/api/v1/reports/dashboard")
          .query(q)
          .set("Authorization", `Bearer ${fx.accountingToken}`)
          .expect(200),
        request(app.getHttpServer())
          .get("/api/v1/reports/summary")
          .query(q)
          .set("Authorization", `Bearer ${fx.accountingToken}`)
          .expect(200),
      ]);
      const elapsedMs = Date.now() - t0;
      expect(elapsedMs).toBeLessThan(2000);

      const df = dashRes.body.financials;
      const rt = repRes.body.totals;
      expect(df).toEqual(rt);

      const sumBuckets = (field: string) =>
        fromSatang(
          repRes.body.buckets.reduce(
            (acc: bigint, b: Record<string, string>) => acc + toSatang(b[field] ?? "0.00"),
            0n,
          ),
        );

      expect(df.ownerNetIncome).toBe(sumBuckets("ownerNetIncome"));
      expect(df.totalCommission).toBe(sumBuckets("totalCommission"));
      expect(df.agentShare).toBe(sumBuckets("agentShare"));
      expect(df.companyNetIncome).toBe(sumBuckets("companyNetIncome"));
      expect(df.receivables).toBe(sumBuckets("receivables"));
      expect(df.payables).toBe(sumBuckets("payables"));
    }

    const fullDash = await request(app.getHttpServer())
      .get("/api/v1/reports/dashboard")
      .set("Authorization", `Bearer ${fx.accountingToken}`)
      .expect(200);

    expect(fullDash.body.topKpis).toHaveLength(5);
    expect(fullDash.body.financials.ownerNetIncome).toBe("23000.00");
    expect(fullDash.body.financials.totalCommission).toBe("180000.00");
    expect(fullDash.body.financials.companyNetIncome).toBe("74000.00");
    expect(fullDash.body.financials.receivables).toBe("45000.00");
    expect(fullDash.body.financials.payables).toBe("129000.00");
  });

  it("2) Data Scope: Manager ทีมสุขุมวิทเห็นเฉพาะตัวเลขทีมตัวเอง ไม่เห็นดีลขายของทีมสีลม", async () => {
    const mgrDash = await request(app.getHttpServer())
      .get("/api/v1/reports/dashboard")
      .set("Authorization", `Bearer ${fx.mgrSukhumvitToken}`)
      .expect(200);

    expect(mgrDash.body.funnel.closedDeals).toBe(2);
    expect(mgrDash.body.financials.totalCommission).toBe("30000.00");
    expect(mgrDash.body.financials.ownerNetIncome).toBe("23000.00");
    expect(mgrDash.body.financials.companyNetIncome).toBe("29000.00");
  });

  it("3) Export CSV และ Excel: ผู้ไม่มีสิทธิ์ report.export ได้ 403; ผู้มีสิทธิ์ดาวน์โหลดภาษาไทยไม่เพี้ยน และมี audit EXPORT", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/reports/export?format=csv")
      .set("Authorization", `Bearer ${fx.agSukhumvitToken}`)
      .expect(403);

    const csvRes = await request(app.getHttpServer())
      .get("/api/v1/reports/export?format=csv&groupBy=OWNERSHIP")
      .set("Authorization", `Bearer ${fx.mgrSukhumvitToken}`)
      .expect(200);

    expect(csvRes.headers["content-type"]).toContain("text/csv");
    expect(csvRes.text.startsWith("\uFEFF")).toBe(true);
    expect(csvRes.text).toContain("รายได้สุทธิบริษัท (บาท)");
    expect(csvRes.text).toContain("ห้องของบริษัท (OWNER)");

    const xlsxRes = await request(app.getHttpServer())
      .get("/api/v1/reports/export?format=xlsx&groupBy=PROJECT")
      .set("Authorization", `Bearer ${fx.accountingToken}`)
      .expect(200);

    expect(xlsxRes.headers["content-type"]).toContain("spreadsheetml");
    expect(xlsxRes.text).toContain("รายงานสรุป RRS");
    expect(xlsxRes.text).toContain("รวมทั้งหมด");

    const exportAudits = await prisma.auditLog.findMany({
      where: { action: "EXPORT", entityType: "Report" },
    });
    expect(exportAudits.length).toBeGreaterThanOrEqual(2);
  });
});
