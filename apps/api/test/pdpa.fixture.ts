import type { INestApplication } from "@nestjs/common";
import { Prisma } from "@rrs/db";
import type { PrismaService } from "../src/prisma/prisma.service";
import { createTestApp, createUser, resetRoleCache } from "./helpers";
import { loginGetToken } from "./notifications.fixture";

export interface PdpaTestCtx {
  app: INestApplication;
  prisma: PrismaService;
  adminToken: string;
  agentToken: string;
  leadWithContractId: string;
  leadOldName: string;
  leadOldPhone: string;
  ownerId: string;
  staleLostLeadId: string;
  recentLostLeadId: string;
}

export async function setupPdpaTestSuite(): Promise<PdpaTestCtx> {
  resetRoleCache();
  const { app, prisma } = await createTestApp();
  const sfx = Date.now();

  const team = await prisma.team.create({ data: { name: `ทีมทดสอบ PDPA ${sfx}` } });
  const adminEmail = `admin.p24.${sfx}@test.local`;
  const agentEmail = `agent.p24.${sfx}@test.local`;
  const admin = await createUser(app, { email: adminEmail, role: "ADMIN" });
  const agent = await createUser(app, { email: agentEmail, role: "AGENT", teamId: team.id });

  const adminToken = await loginGetToken(app, adminEmail);
  const agentToken = await loginGetToken(app, agentEmail);

  const owner = await prisma.owner.create({
    data: {
      code: `OW-24-${sfx}`,
      fullName: "คุณเจ้าของ พีดีพีเอ",
      phone: "+66899992401",
      email: "owner.p24@example.com",
      lineId: "owner_line_p24",
      agentId: agent.id,
    },
  });

  const asset = await prisma.asset.create({
    data: {
      code: `PR-24-${sfx}`,
      category: "CONDO",
      ownershipType: "OWNER",
      ownerId: owner.id,
      rentPrice: new Prisma.Decimal("20000.00"),
      primaryAgentId: agent.id,
      status: "CONTRACTED",
    },
  });

  const leadOldName = `คุณสมชาย ลบข้อมูลส่วนบุคคล ${sfx}`;
  const leadOldPhone = `+6689${String(sfx).slice(-7)}`;

  const leadWithContract = await prisma.lead.create({
    data: {
      code: `LD-24A-${sfx}`,
      intent: "RENT",
      fullName: leadOldName,
      phone: leadOldPhone,
      lineId: "somchai_pdpa_24",
      email: "somchai.p24@example.com",
      source: "WEBSITE",
      ownerAgentId: agent.id,
      status: "CONTRACTED",
    },
  });

  await prisma.activity.create({
    data: {
      type: "CALL",
      leadId: leadWithContract.id,
      body: `โทรหา ${leadOldName} เบอร์ ${leadOldPhone} ยืนยันสัญญาเช่า`,
      createdById: agent.id,
    },
  });

  const contract = await prisma.contract.create({
    data: {
      contractNo: `LS-2026-${String(sfx).slice(-4)}`,
      assetId: asset.id,
      leadId: leadWithContract.id,
      ownerId: owner.id,
      monthlyRent: new Prisma.Decimal("20000.00"),
      securityDeposit: new Prisma.Decimal("40000.00"),
      advanceRent: new Prisma.Decimal("20000.00"),
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      endDate: new Date("2026-12-31T00:00:00.000Z"),
      status: "ACTIVE",
      signedAt: new Date("2026-01-01T10:00:00.000Z"),
      parties: {
        create: [
          {
            partyType: "TENANT",
            fullName: leadOldName,
            phone: leadOldPhone,
            email: "somchai.p24@example.com",
            idNumber: "1100700123456",
          },
        ],
      },
    },
  });

  await prisma.payment.create({
    data: {
      type: "MONTHLY_RENT",
      direction: "IN",
      amount: new Prisma.Decimal("20000.00"),
      paidAt: new Date("2026-02-05T10:00:00.000Z"),
      method: "BANK_TRANSFER",
      assetId: asset.id,
      contractId: contract.id,
      receivedById: admin.id,
    },
  });

  await prisma.commission.create({
    data: {
      contractId: contract.id,
      assetId: asset.id,
      ownershipType: "OWNER",
      formula: "ONE_MONTH",
      baseAmount: new Prisma.Decimal("20000.00"),
      termMonths: 12,
      totalAmount: new Prisma.Decimal("20000.00"),
      status: "APPROVED",
      approvedById: admin.id,
      approvedAt: new Date("2026-02-05T12:00:00.000Z"),
      splits: {
        create: [
          {
            revision: 1,
            role: "CLOSER",
            userId: agent.id,
            shareType: "PERCENT",
            sharePercent: new Prisma.Decimal("50.00"),
            amount: new Prisma.Decimal("10000.00"),
            withholdingTax: new Prisma.Decimal("0.00"),
            netAmount: new Prisma.Decimal("10000.00"),
          },
          {
            revision: 1,
            role: "COMPANY",
            userId: null,
            shareType: "PERCENT",
            sharePercent: new Prisma.Decimal("50.00"),
            amount: new Prisma.Decimal("10000.00"),
            withholdingTax: new Prisma.Decimal("0.00"),
            netAmount: new Prisma.Decimal("10000.00"),
          },
        ],
      },
    },
  });

  const staleLostLead = await prisma.lead.create({
    data: {
      code: `LD-24B-${sfx}`,
      intent: "RENT",
      fullName: "ลูกค้าเก่าเกินสองปี ต้องลบ",
      phone: "+66890002402",
      source: "FACEBOOK",
      ownerAgentId: agent.id,
      status: "LOST",
      lastActivityAt: new Date("2023-06-01T00:00:00.000Z"),
    },
  });

  const recentLostLead = await prisma.lead.create({
    data: {
      code: `LD-24C-${sfx}`,
      intent: "RENT",
      fullName: "ลูกค้าเพิ่งปิด LOST ยังไม่ถึงเกณฑ์",
      phone: "+66890002403",
      source: "LINE",
      ownerAgentId: agent.id,
      status: "LOST",
      lastActivityAt: new Date("2026-09-01T00:00:00.000Z"),
    },
  });

  return {
    app,
    prisma,
    adminToken,
    agentToken,
    leadWithContractId: leadWithContract.id,
    leadOldName,
    leadOldPhone,
    ownerId: owner.id,
    staleLostLeadId: staleLostLead.id,
    recentLostLeadId: recentLostLead.id,
  };
}
