import type { INestApplication } from "@nestjs/common";
import { authenticator } from "otplib";
import request from "supertest";
import type { PrismaService } from "../src/prisma/prisma.service";
import { PASSWORD, createUser } from "./helpers";

async function loginGetToken(app: INestApplication, email: string) {
  const res = await request(app.getHttpServer()).post("/api/v1/auth/login").send({ email, password: PASSWORD });
  if (res.body.status === "OK") return res.body.accessToken as string;
  const challengeToken = res.body.challengeToken as string;
  const setup = await request(app.getHttpServer()).post("/api/v1/auth/mfa/setup").send({ challengeToken });
  const code = authenticator.generate(setup.body.secret as string);
  const enabled = await request(app.getHttpServer()).post("/api/v1/auth/mfa/enable").send({ challengeToken, code });
  return enabled.body.accessToken as string;
}

export async function setupCommissionsFixture(app: INestApplication, prisma: PrismaService) {
  const sfx = Date.now();
  const team = await prisma.team.create({ data: { name: `ทีม P15 ${sfx}` } });

  const accEmail = `acc.p15.${sfx}@test.local`;
  const mgrEmail = `mgr.p15.${sfx}@test.local`;
  const agAEmail = `aga.p15.${sfx}@test.local`;
  const agBEmail = `agb.p15.${sfx}@test.local`;
  const agCEmail = `agc.p15.${sfx}@test.local`;

  await createUser(app, { email: accEmail, role: "ACCOUNTING" });
  await createUser(app, { email: mgrEmail, role: "MANAGER", teamId: team.id });
  const agA = await createUser(app, { email: agAEmail, role: "AGENT", teamId: team.id });
  const agB = await createUser(app, { email: agBEmail, role: "AGENT", teamId: team.id });
  const agC = await createUser(app, { email: agCEmail, role: "AGENT", teamId: team.id });

  await prisma.user.update({ where: { id: agC.id }, data: { isFreelance: true } });

  const accountingToken = await loginGetToken(app, accEmail);
  const managerToken = await loginGetToken(app, mgrEmail);
  const agentAToken = await loginGetToken(app, agAEmail);

  const owner = await prisma.owner.create({
    data: { code: `OW-P15-${sfx}`, fullName: "เจ้าของ P15", phone: `+6681${String(sfx).slice(-7)}`, agentId: agA.id },
  });
  const companyOwner =
    (await prisma.owner.findFirst({ where: { isCompany: true } })) ??
    (await prisma.owner.create({
      data: { code: `OW-CO-${sfx}`, fullName: "บริษัท RRS", phone: `+6682${String(sfx).slice(-7)}`, isCompany: true },
    }));

  const [agentAsset, ownerAsset, leadA, leadO] = await Promise.all([
    prisma.asset.create({
      data: {
        code: `PR-P15-A-${sfx}`,
        category: "CONDO",
        ownershipType: "AGENT",
        ownerId: owner.id,
        primaryAgentId: agB.id,
        rentPrice: "30000.00",
      },
    }),
    prisma.asset.create({
      data: {
        code: `PR-P15-O-${sfx}`,
        category: "CONDO",
        ownershipType: "OWNER",
        ownerId: companyOwner.id,
        primaryAgentId: agA.id,
        rentPrice: "20000.00",
      },
    }),
    prisma.lead.create({
      data: {
        code: `LD-P15-A-${sfx}`,
        intent: "RENT",
        source: "LINE",
        status: "CLOSED_WON",
        fullName: "ลูกค้า A",
        phone: `+6683${String(sfx).slice(-7)}`,
        ownerAgentId: agA.id,
      },
    }),
    prisma.lead.create({
      data: {
        code: `LD-P15-O-${sfx}`,
        intent: "RENT",
        source: "WALK_IN",
        status: "CLOSED_WON",
        fullName: "ลูกค้า O",
        phone: `+6684${String(sfx).slice(-7)}`,
        ownerAgentId: agA.id,
      },
    }),
  ]);

  const [dealA, dealO, file] = await Promise.all([
    prisma.saleDeal.create({
      data: {
        code: `SD-P15-A-${sfx}`,
        assetId: agentAsset.id,
        ownerId: owner.id,
        agentId: agC.id,
        leadId: leadA.id,
        stage: "CLOSED",
        agreedPrice: "30000.00",
      },
    }),
    prisma.saleDeal.create({
      data: {
        code: `SD-P15-O-${sfx}`,
        assetId: ownerAsset.id,
        ownerId: companyOwner.id,
        agentId: agA.id,
        leadId: leadO.id,
        stage: "CLOSED",
        agreedPrice: "20000.00",
      },
    }),
    prisma.file.create({
      data: {
        storageKey: `p15/proof-${sfx}.pdf`,
        originalName: "slip.pdf",
        mimeType: "application/pdf",
        sizeBytes: 2048,
      },
    }),
  ]);

  const [agentCom, ownerCom] = await Promise.all([
    prisma.commission.create({
      data: {
        assetId: agentAsset.id,
        saleDealId: dealA.id,
        ownershipType: "AGENT",
        formula: "ONE_MONTH",
        baseAmount: "30000.00",
        termMonths: 12,
        totalAmount: "0.00",
        status: "PENDING_CALC",
      },
    }),
    prisma.commission.create({
      data: {
        assetId: ownerAsset.id,
        saleDealId: dealO.id,
        ownershipType: "OWNER",
        formula: "ONE_MONTH",
        baseAmount: "20000.00",
        termMonths: 12,
        totalAmount: "0.00",
        status: "PENDING_CALC",
      },
    }),
  ]);

  return {
    accountingToken,
    managerToken,
    agentAToken,
    agentAId: agA.id,
    agentBId: agB.id,
    agentCId: agC.id,
    agentCommissionId: agentCom.id,
    ownerCommissionId: ownerCom.id,
    proofFileId: file.id,
  };
}
