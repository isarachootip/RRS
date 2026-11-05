import type { INestApplication } from "@nestjs/common";
import { authenticator } from "otplib";
import request from "supertest";
import type { PrismaService } from "../src/prisma/prisma.service";
import { PASSWORD, createUser } from "./helpers";
import { seedReportsDashboardDeals } from "./reports-dashboard-seed.fixture";

async function loginGetToken(app: INestApplication, email: string) {
  const res = await request(app.getHttpServer()).post("/api/v1/auth/login").send({ email, password: PASSWORD });
  if (res.body.status === "OK") return res.body.accessToken as string;
  const challengeToken = res.body.challengeToken as string;
  const setup = await request(app.getHttpServer()).post("/api/v1/auth/mfa/setup").send({ challengeToken });
  const code = authenticator.generate(setup.body.secret as string);
  const enabled = await request(app.getHttpServer()).post("/api/v1/auth/mfa/enable").send({ challengeToken, code });
  return enabled.body.accessToken as string;
}

export async function setupReportsDashboardFixture(app: INestApplication, prisma: PrismaService) {
  const sfx = Date.now();
  const [sukhumvitTeam, silomTeam] = await Promise.all([
    prisma.team.create({ data: { name: `ทีมสุขุมวิท ${sfx}` } }),
    prisma.team.create({ data: { name: `ทีมสีลม ${sfx}` } }),
  ]);

  const accEmail = `acc.p16.${sfx}@test.local`;
  const mgrSukEmail = `mgr.suk.${sfx}@test.local`;
  const agSukEmail = `ag.suk.${sfx}@test.local`;
  const agSilEmail = `ag.sil.${sfx}@test.local`;

  await createUser(app, { email: accEmail, role: "ACCOUNTING" });
  await createUser(app, { email: mgrSukEmail, role: "MANAGER", teamId: sukhumvitTeam.id });
  const agSuk = await createUser(app, { email: agSukEmail, role: "AGENT", teamId: sukhumvitTeam.id });
  const agSil = await createUser(app, { email: agSilEmail, role: "AGENT", teamId: silomTeam.id });

  const accountingToken = await loginGetToken(app, accEmail);
  const mgrSukhumvitToken = await loginGetToken(app, mgrSukEmail);
  const agSukhumvitToken = await loginGetToken(app, agSukEmail);

  const [compOwner, extOwner, projA, projB] = await Promise.all([
    prisma.owner.create({
      data: {
        code: `OW-CO-16-${sfx}`,
        fullName: "บริษัท RRS",
        phone: `+6681${String(sfx).slice(-7)}`,
        isCompany: true,
      },
    }),
    prisma.owner.create({
      data: {
        code: `OW-EX-16-${sfx}`,
        fullName: "เจ้าของฝากขาย",
        phone: `+6682${String(sfx).slice(-7)}`,
        agentId: agSil.id,
      },
    }),
    prisma.project.create({ data: { name: `โครงการสุขุมวิท ${sfx}` } }),
    prisma.project.create({ data: { name: `โครงการสีลม ${sfx}` } }),
  ]);

  const [ownerAsset, agentRentAsset, agentSaleAsset] = await Promise.all([
    prisma.asset.create({
      data: {
        code: `PR-16-O-${sfx}`,
        category: "CONDO",
        ownershipType: "OWNER",
        ownerId: compOwner.id,
        projectId: projA.id,
        primaryAgentId: agSuk.id,
        status: "CONTRACTED",
        forRent: true,
        rentPrice: "25000.00",
      },
    }),
    prisma.asset.create({
      data: {
        code: `PR-16-AR-${sfx}`,
        category: "CONDO",
        ownershipType: "AGENT",
        ownerId: extOwner.id,
        projectId: projA.id,
        primaryAgentId: agSuk.id,
        status: "CONTRACTED",
        forRent: true,
        rentPrice: "30000.00",
      },
    }),
    prisma.asset.create({
      data: {
        code: `PR-16-AS-${sfx}`,
        category: "HOUSE",
        ownershipType: "AGENT",
        ownerId: extOwner.id,
        projectId: projB.id,
        primaryAgentId: agSil.id,
        status: "SOLD",
        forRent: false,
        forSale: true,
        salePrice: "5000000.00",
      },
    }),
  ]);

  const [leadSuk1, leadSuk2, leadSil] = await Promise.all([
    prisma.lead.create({
      data: {
        code: `LD-16-1-${sfx}`,
        intent: "RENT",
        source: "LINE",
        status: "CONTRACTED",
        fullName: "ลูกค้าสุขุมวิท 1",
        phone: `+6683${String(sfx).slice(-7)}`,
        ownerAgentId: agSuk.id,
      },
    }),
    prisma.lead.create({
      data: {
        code: `LD-16-2-${sfx}`,
        intent: "RENT",
        source: "FACEBOOK",
        status: "CONTRACTED",
        fullName: "ลูกค้าสุขุมวิท 2",
        phone: `+6684${String(sfx).slice(-7)}`,
        ownerAgentId: agSuk.id,
      },
    }),
    prisma.lead.create({
      data: {
        code: `LD-16-3-${sfx}`,
        intent: "BUY",
        source: "WEBSITE",
        status: "CLOSED_WON",
        fullName: "ลูกค้าสีลม",
        phone: `+6685${String(sfx).slice(-7)}`,
        ownerAgentId: agSil.id,
      },
    }),
  ]);

  await seedReportsDashboardDeals(prisma, {
    sfx,
    compOwnerId: compOwner.id,
    extOwnerId: extOwner.id,
    ownerAssetId: ownerAsset.id,
    agentRentAssetId: agentRentAsset.id,
    agentSaleAssetId: agentSaleAsset.id,
    leadSuk1Id: leadSuk1.id,
    leadSuk2Id: leadSuk2.id,
    leadSilId: leadSil.id,
    agSukId: agSuk.id,
    agSilId: agSil.id,
  });

  return {
    accountingToken,
    mgrSukhumvitToken,
    agSukhumvitToken,
    sukhumvitTeamId: sukhumvitTeam.id,
    silomTeamId: silomTeam.id,
    projAId: projA.id,
    projBId: projB.id,
  };
}
