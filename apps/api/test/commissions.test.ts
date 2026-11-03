import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaService } from "../src/prisma/prisma.service";
import { setupCommissionsFixture } from "./commissions.fixture";
import { createTestApp, resetRoleCache } from "./helpers";

describe("P15 · อนุมัติและจ่ายค่านายหน้า (Workflow, Revisions Immutability, Batch Payout, Agent Data Scope)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let fx: Awaited<ReturnType<typeof setupCommissionsFixture>>;

  beforeAll(async () => {
    resetRoleCache();
    ({ app, prisma } = await createTestApp());
    fx = await setupCommissionsFixture(app, prisma);
  });

  afterAll(async () => {
    await app?.close();
  });

  it("1) คำนวณ 30,000 แบ่ง 30/20/30/20 → 9,000/6,000/9,000/6,000 พอดี และบล็อกเมื่อแบ่งรวม 110%", async () => {
    const badRes = await request(app.getHttpServer())
      .put(`/api/v1/commissions/${fx.agentCommissionId}/splits`)
      .set("Authorization", `Bearer ${fx.managerToken}`)
      .send({
        formula: "ONE_MONTH",
        baseAmount: "30000.00",
        splits: [
          { role: "FINDER", userId: fx.agentAId, shareType: "PERCENT", sharePercent: "40" },
          { role: "LISTING", userId: fx.agentBId, shareType: "PERCENT", sharePercent: "20" },
          { role: "CLOSER", userId: fx.agentCId, shareType: "PERCENT", sharePercent: "30" },
          { role: "COMPANY", userId: null, shareType: "PERCENT", sharePercent: "20" },
        ],
      })
      .expect(400);
    expect(badRes.body.message).toContain("10.00%");

    const okRes = await request(app.getHttpServer())
      .put(`/api/v1/commissions/${fx.agentCommissionId}/splits`)
      .set("Authorization", `Bearer ${fx.managerToken}`)
      .send({
        formula: "ONE_MONTH",
        baseAmount: "30000.00",
        splits: [
          { role: "FINDER", userId: fx.agentAId, shareType: "PERCENT", sharePercent: "30" },
          { role: "LISTING", userId: fx.agentBId, shareType: "PERCENT", sharePercent: "20" },
          { role: "CLOSER", userId: fx.agentCId, shareType: "PERCENT", sharePercent: "30" },
          { role: "COMPANY", userId: null, shareType: "PERCENT", sharePercent: "20" },
        ],
      })
      .expect(200);

    expect(okRes.body.status).toBe("PENDING_REVIEW");
    expect(okRes.body.totalAmount).toBe("30000.00");
    const amounts = okRes.body.currentSplits.map((s: { amount: string }) => s.amount);
    expect(amounts).toEqual(["9000.00", "6000.00", "9000.00", "6000.00"]);
  });

  it("2) อนุมัติแล้ว snapshot ลง commission_revisions; แก้หลังอนุมัติต้องมีเหตุผล สร้างฉบับที่ 2 และฉบับแรกดูย้อนได้", async () => {
    const appRes = await request(app.getHttpServer())
      .post(`/api/v1/commissions/${fx.agentCommissionId}/approve`)
      .set("Authorization", `Bearer ${fx.accountingToken}`)
      .send({ ownerPaymentDueAt: "2026-12-01" })
      .expect(201);

    expect(appRes.body.status).toBe("AWAITING_OWNER_PAYMENT");
    expect(appRes.body.revisions).toHaveLength(1);
    expect(appRes.body.revisions[0].revision).toBe(1);
    expect(appRes.body.revisions[0].approvedAt).toBeTruthy();

    await request(app.getHttpServer())
      .put(`/api/v1/commissions/${fx.agentCommissionId}/splits`)
      .set("Authorization", `Bearer ${fx.accountingToken}`)
      .send({
        formula: "ONE_MONTH",
        baseAmount: "30000.00",
        splits: [
          { role: "FINDER", userId: fx.agentAId, shareType: "PERCENT", sharePercent: "50" },
          { role: "COMPANY", userId: null, shareType: "PERCENT", sharePercent: "50" },
        ],
      })
      .expect(400);

    const rev2Res = await request(app.getHttpServer())
      .put(`/api/v1/commissions/${fx.agentCommissionId}/splits`)
      .set("Authorization", `Bearer ${fx.accountingToken}`)
      .send({
        formula: "ONE_MONTH",
        baseAmount: "30000.00",
        reason: "ปรับสัดส่วนผู้ดูแลห้องและผู้ปิดดีลตามข้อตกลงใหม่",
        splits: [
          { role: "FINDER", userId: fx.agentAId, shareType: "PERCENT", sharePercent: "30" },
          { role: "LISTING", userId: fx.agentBId, shareType: "PERCENT", sharePercent: "30" },
          { role: "CLOSER", userId: fx.agentCId, shareType: "PERCENT", sharePercent: "20" },
          { role: "COMPANY", userId: null, shareType: "PERCENT", sharePercent: "20" },
        ],
      })
      .expect(200);

    expect(rev2Res.body.currentRevision).toBe(2);
    expect(rev2Res.body.status).toBe("PENDING_REVIEW");
    expect(rev2Res.body.revisions).toHaveLength(2);
    expect(rev2Res.body.revisions[0].snapshot.splits[1].amount).toBe("6000.00");
    expect(rev2Res.body.revisions[1].reason).toContain("ข้อตกลงใหม่");

    const reApprove = await request(app.getHttpServer())
      .post(`/api/v1/commissions/${fx.agentCommissionId}/approve`)
      .set("Authorization", `Bearer ${fx.accountingToken}`)
      .send({})
      .expect(201);
    expect(reApprove.body.status).toBe("AWAITING_OWNER_PAYMENT");
    expect(reApprove.body.revisions[1].approvedAt).toBeTruthy();
  });

  it("3) ห้อง OWNER ข้ามขั้นรอรับเงินเจ้าของ; รับเงินห้อง AGENT + จ่าย Payout รวมหลายดีลจนเป็น PAID และ Agent เห็นเฉพาะส่วนของตัวเอง", async () => {
    await request(app.getHttpServer())
      .put(`/api/v1/commissions/${fx.ownerCommissionId}/splits`)
      .set("Authorization", `Bearer ${fx.accountingToken}`)
      .send({
        formula: "ONE_MONTH",
        baseAmount: "20000.00",
        splits: [
          { role: "FINDER", userId: fx.agentAId, shareType: "PERCENT", sharePercent: "80" },
          { role: "COMPANY", userId: null, shareType: "PERCENT", sharePercent: "20" },
        ],
      })
      .expect(200);

    const ownerApprove = await request(app.getHttpServer())
      .post(`/api/v1/commissions/${fx.ownerCommissionId}/approve`)
      .set("Authorization", `Bearer ${fx.accountingToken}`)
      .send({})
      .expect(201);
    expect(ownerApprove.body.status).toBe("AWAITING_PAYOUT");

    await request(app.getHttpServer())
      .post(`/api/v1/commissions/${fx.ownerCommissionId}/receive`)
      .set("Authorization", `Bearer ${fx.accountingToken}`)
      .send({ method: "BANK_TRANSFER" })
      .expect(400);

    const recRes = await request(app.getHttpServer())
      .post(`/api/v1/commissions/${fx.agentCommissionId}/receive`)
      .set("Authorization", `Bearer ${fx.accountingToken}`)
      .send({ method: "BANK_TRANSFER", proofFileId: fx.proofFileId, reference: "SLIP-001" })
      .expect(201);
    expect(recRes.body.status).toBe("RECEIVED");

    const agAView = await request(app.getHttpServer())
      .get(`/api/v1/commissions/${fx.agentCommissionId}`)
      .set("Authorization", `Bearer ${fx.agentAToken}`)
      .expect(200);
    expect(agAView.body.splits.every((s: { userId: string }) => s.userId === fx.agentAId)).toBe(true);

    const splitA1 = recRes.body.currentSplits.find((s: { userId: string }) => s.userId === fx.agentAId).id;
    const splitA2 = ownerApprove.body.currentSplits.find((s: { userId: string }) => s.userId === fx.agentAId).id;
    const splitB = recRes.body.currentSplits.find((s: { userId: string }) => s.userId === fx.agentBId).id;
    const splitC = recRes.body.currentSplits.find((s: { userId: string }) => s.userId === fx.agentCId).id;

    const payoutA = await request(app.getHttpServer())
      .post("/api/v1/commissions/payouts")
      .set("Authorization", `Bearer ${fx.accountingToken}`)
      .send({ userId: fx.agentAId, periodLabel: "รอบวันที่ 5 พ.ย. 2026", splitIds: [splitA1, splitA2] })
      .expect(201);
    expect(payoutA.body.totalAmount).toBe("25000.00");

    await request(app.getHttpServer())
      .post(`/api/v1/commissions/payouts/${payoutA.body.id}/pay`)
      .set("Authorization", `Bearer ${fx.accountingToken}`)
      .send({ method: "BANK_TRANSFER", proofFileId: fx.proofFileId })
      .expect(201);

    const ownerAfterPay = await request(app.getHttpServer())
      .get(`/api/v1/commissions/${fx.ownerCommissionId}`)
      .set("Authorization", `Bearer ${fx.accountingToken}`)
      .expect(200);
    expect(ownerAfterPay.body.status).toBe("PAID");

    await request(app.getHttpServer())
      .post("/api/v1/commissions/payouts")
      .set("Authorization", `Bearer ${fx.accountingToken}`)
      .send({ userId: fx.agentBId, periodLabel: "รอบวันที่ 5 พ.ย. 2026", splitIds: [splitB], payImmediately: true })
      .expect(201);
    await request(app.getHttpServer())
      .post("/api/v1/commissions/payouts")
      .set("Authorization", `Bearer ${fx.accountingToken}`)
      .send({ userId: fx.agentCId, periodLabel: "รอบวันที่ 5 พ.ย. 2026", splitIds: [splitC], payImmediately: true })
      .expect(201);

    const agentAfterPay = await request(app.getHttpServer())
      .get(`/api/v1/commissions/${fx.agentCommissionId}`)
      .set("Authorization", `Bearer ${fx.accountingToken}`)
      .expect(200);
    expect(agentAfterPay.body.status).toBe("PAID");
  });
});
