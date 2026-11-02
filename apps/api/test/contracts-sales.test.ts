import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaService } from "../src/prisma/prisma.service";
import { PASSWORD, createTestApp, createUser, resetRoleCache } from "./helpers";

describe("P12 · สัญญาเช่า (Revision, ต่อสัญญา, ยกเลิกก่อนกำหนด, หมดอายุคืนห้องว่าง) และ Pipeline งานขาย", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let agentToken = "";
  let agentId = "";
  let rentLeadId = "";
  let buyLeadId = "";
  let rentAssetId = "";
  let saleAssetId = "";
  let paidBookingId = "";
  let firstContractId = "";
  let revisedContractId = "";

  beforeAll(async () => {
    resetRoleCache();
    ({ app, prisma } = await createTestApp());
    const sfx = Date.now();
    const email = `agent.p12.${sfx}@test.local`;
    const team = await prisma.team.create({ data: { name: `ทีม P12 ${sfx}` } });
    const agent = await createUser(app, { email, role: "AGENT", teamId: team.id });
    agentId = agent.id;

    const loginRes = await request(app.getHttpServer()).post("/api/v1/auth/login").send({ email, password: PASSWORD });
    agentToken = loginRes.body.accessToken;

    const owner = await prisma.owner.create({
      data: { code: `OW-${sfx}`, fullName: "เจ้าของ P12", phone: `+6684${String(sfx).slice(-7)}`, agentId },
    });
    const base = { ownershipType: "AGENT" as const, ownerId: owner.id, primaryAgentId: agentId };
    const [rentAsset, saleAsset] = await Promise.all([
      prisma.asset.create({
        data: { ...base, code: `PR-${sfx}-R`, category: "CONDO", forRent: true, rentPrice: 25000 },
      }),
      prisma.asset.create({
        data: { ...base, code: `PR-${sfx}-S`, category: "HOUSE", forSale: true, salePrice: 8500000 },
      }),
    ]);
    rentAssetId = rentAsset.id;
    saleAssetId = saleAsset.id;

    const lBase = { source: "LINE" as const, status: "NEW" as const, ownerAgentId: agentId };
    const [rentLead, buyLead] = await Promise.all([
      prisma.lead.create({
        data: {
          ...lBase,
          code: `LD-${sfx}-R`,
          intent: "RENT",
          fullName: "เช่า",
          phone: `+6688${String(sfx).slice(-7)}`,
        },
      }),
      prisma.lead.create({
        data: {
          ...lBase,
          code: `LD-${sfx}-B`,
          intent: "BUY",
          fullName: "ซื้อ",
          phone: `+6689${String(sfx).slice(-7)}`,
        },
      }),
    ]);
    rentLeadId = rentLead.id;
    buyLeadId = buyLead.id;

    const bkRes = await request(app.getHttpServer())
      .post("/api/v1/bookings")
      .set("Authorization", `Bearer ${agentToken}`)
      .send({
        leadId: rentLeadId,
        assetId: rentAssetId,
        monthlyRent: 25000,
        bookingFee: 10000,
        securityDeposit: 50000,
        advanceRent: 25000,
        startDate: "2027-01-01",
        endDate: "2027-12-31",
        payImmediately: true,
      })
      .expect(201);
    paidBookingId = bkRes.body.id;
  });

  afterAll(async () => {
    await app?.close();
  });

  it("แปลง Booking ที่ชำระแล้วเป็นสัญญาเช่า (LS-YYYY-NNNN) → ลงนาม ACTIVE → ห้องเป็น CONTRACTED และสร้าง Commission สถานะ PENDING_CALC", async () => {
    const createRes = await request(app.getHttpServer())
      .post("/api/v1/contracts")
      .set("Authorization", `Bearer ${agentToken}`)
      .send({ bookingId: paidBookingId, status: "DRAFT", note: "ร่างสัญญาเช่า 1 ปี" })
      .expect(201);

    firstContractId = createRes.body.id;
    expect(createRes.body.contractNo).toMatch(/^LS-2027-\d{4}$/);
    expect(createRes.body.booking.status).toBe("CONVERTED");
    expect(createRes.body.parties).toHaveLength(1);

    const signRes = await request(app.getHttpServer())
      .post(`/api/v1/contracts/${firstContractId}/sign`)
      .set("Authorization", `Bearer ${agentToken}`)
      .send({ commissionFormula: "ONE_MONTH" })
      .expect(200);

    expect(signRes.body.status).toBe("ACTIVE");
    expect(signRes.body.asset.status).toBe("CONTRACTED");
    expect(signRes.body.lead.status).toBe("CONTRACTED");
    expect(signRes.body.commission.status).toBe("PENDING_CALC");
  });

  it("แก้ไขสัญญาที่มีผลแล้ว (ACTIVE) → สร้างแถวใหม่ revision 2 (-R2) และแถวเดิมเป็น SUPERSEDED โดยข้อมูลเดิมไม่เปลี่ยน", async () => {
    const revRes = await request(app.getHttpServer())
      .patch(`/api/v1/contracts/${firstContractId}`)
      .set("Authorization", `Bearer ${agentToken}`)
      .send({ monthlyRent: 23000, note: "ลดค่าเช่าพิเศษ" })
      .expect(200);

    revisedContractId = revRes.body.id;
    expect(revisedContractId).not.toBe(firstContractId);
    expect(revRes.body.revision).toBe(2);
    expect(revRes.body.contractNo).toMatch(/-R2$/);
    expect(revRes.body.revisionOfId).toBe(firstContractId);
    expect(Number(revRes.body.monthlyRent)).toBe(23000);
    expect(Number(revRes.body.commission.baseAmount)).toBe(23000);

    const oldContract = await prisma.contract.findUniqueOrThrow({ where: { id: firstContractId } });
    expect(oldContract.status).toBe("SUPERSEDED");
    expect(Number(oldContract.monthlyRent)).toBe(25000);
  });

  it("ต่อสัญญาเช่าผูก previousContractId, ดูประวัติการเช่าต่อห้อง/ลูกค้าได้ และเมื่อสัญญาหมดอายุ (Job expire) ห้องกลับเป็น AVAILABLE", async () => {
    const renewRes = await request(app.getHttpServer())
      .post(`/api/v1/contracts/${revisedContractId}/renew`)
      .set("Authorization", `Bearer ${agentToken}`)
      .send({ startDate: "2028-01-01", endDate: "2028-12-31", monthlyRent: 24000, activateImmediately: true })
      .expect(201);

    expect(renewRes.body.previousContractId).toBe(revisedContractId);
    expect(renewRes.body.status).toBe("ACTIVE");

    const historyRes = await request(app.getHttpServer())
      .get(`/api/v1/contracts/history/asset/${rentAssetId}`)
      .set("Authorization", `Bearer ${agentToken}`)
      .expect(200);
    expect(historyRes.body.length).toBeGreaterThanOrEqual(3);

    const expireRes = await request(app.getHttpServer())
      .post("/api/v1/contracts/jobs/expire")
      .set("Authorization", `Bearer ${agentToken}`)
      .send({ asOfDate: "2029-01-05" })
      .expect(200);

    expect(expireRes.body.expiredCount).toBeGreaterThanOrEqual(1);
    const assetAfterExpire = await prisma.asset.findUniqueOrThrow({ where: { id: rentAssetId } });
    expect(assetAfterExpire.status).toBe("AVAILABLE");
  });

  it("Pipeline งานขาย: INTERESTED → OFFERED → DEPOSIT_PAID → SPA_SIGNED → TRANSFERRED → CLOSED เปลี่ยนห้องเป็น SOLD และสร้าง Commission", async () => {
    const createDealRes = await request(app.getHttpServer())
      .post("/api/v1/sale-deals")
      .set("Authorization", `Bearer ${agentToken}`)
      .send({ leadId: buyLeadId, assetId: saleAssetId, stage: "OFFERED", askingPrice: 8500000, offeredPrice: 8200000 })
      .expect(201);

    const dealId = createDealRes.body.id as string;
    expect(createDealRes.body.code).toMatch(/^SD-/);
    expect(createDealRes.body.asset.status).toBe("NEGOTIATING");

    const closeRes = await request(app.getHttpServer())
      .patch(`/api/v1/sale-deals/${dealId}`)
      .set("Authorization", `Bearer ${agentToken}`)
      .send({
        stage: "CLOSED",
        agreedPrice: 8300000,
        depositAmount: 500000,
        spaSignedAt: "2027-02-01",
        transferDate: "2027-03-15",
        transferFeePayer: "SPLIT",
        loanBank: "ธนาคารกสิกรไทย",
      })
      .expect(200);

    expect(closeRes.body.stage).toBe("CLOSED");
    expect(closeRes.body.transferFeePayer).toBe("SPLIT");
    expect(closeRes.body.asset.status).toBe("SOLD");
    expect(closeRes.body.lead.status).toBe("CLOSED_WON");
    expect(closeRes.body.commission.status).toBe("PENDING_CALC");
    expect(Number(closeRes.body.commission.baseAmount)).toBe(8300000);
  });
});
