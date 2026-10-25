import type { INestApplication } from "@nestjs/common";
import { Prisma } from "@rrs/db";
import { authenticator } from "otplib";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaService } from "../src/prisma/prisma.service";
import { PASSWORD, createTestApp, createUser, resetRoleCache } from "./helpers";

let app: INestApplication;
let prisma: PrismaService;
const http = () => request(app.getHttpServer());
const auth = (token: string) => ({ authorization: `Bearer ${token}` });

interface TestActors {
  adminToken: string;
  managerAToken: string;
  agentAToken: string;
  agentBToken: string;
  accountingToken: string;
  teamAId: string;
  agentBId: string;
  leadAId: string;
  leadBId: string;
  assetAId: string;
  assetBId: string;
}

const actors = {} as TestActors;

async function loginToken(email: string, needMfa = false): Promise<string> {
  const res = await http().post("/api/v1/auth/login").send({ email, password: PASSWORD }).expect(200);
  if (!needMfa && res.body.status === "OK") return res.body.accessToken as string;
  const challengeToken = res.body.challengeToken as string;
  const setup = await http().post("/api/v1/auth/mfa/setup").send({ challengeToken }).expect(200);
  const code = authenticator.generate(setup.body.secret as string);
  const enabled = await http().post("/api/v1/auth/mfa/enable").send({ challengeToken, code }).expect(200);
  return enabled.body.accessToken as string;
}

beforeAll(async () => {
  resetRoleCache();
  ({ app, prisma } = await createTestApp());

  const teamA = await prisma.team.create({ data: { name: "ทีม A" } });
  const teamB = await prisma.team.create({ data: { name: "ทีม B" } });
  actors.teamAId = teamA.id;

  await createUser(app, { email: "admin@rbac.local", role: "ADMIN" });
  const mgrA = await createUser(app, { email: "mgr.a@rbac.local", role: "MANAGER", teamId: teamA.id });
  const agentA = await createUser(app, { email: "agent.a@rbac.local", role: "AGENT", teamId: teamA.id });
  const agentB = await createUser(app, { email: "agent.b@rbac.local", role: "AGENT", teamId: teamB.id });
  await createUser(app, { email: "acc@rbac.local", role: "ACCOUNTING" });
  await prisma.team.update({ where: { id: teamA.id }, data: { managerId: mgrA.id } });
  actors.agentBId = agentB.id;

  actors.adminToken = await loginToken("admin@rbac.local", true);
  actors.managerAToken = await loginToken("mgr.a@rbac.local");
  actors.agentAToken = await loginToken("agent.a@rbac.local");
  actors.agentBToken = await loginToken("agent.b@rbac.local");
  actors.accountingToken = await loginToken("acc@rbac.local", true);

  const ownerA = await prisma.owner.create({
    data: { code: "OW-000101", fullName: "เจ้าของ เอ", phone: "+66811112222", lineId: "oa", agentId: agentA.id },
  });
  const ownerB = await prisma.owner.create({
    data: { code: "OW-000102", fullName: "เจ้าของ บี", phone: "+66899998888", lineId: "ob", agentId: agentB.id },
  });
  const mkAsset = (code: string, ownerId: string, agentId: string, rent: string, minRent: string) =>
    prisma.asset.create({
      data: {
        code,
        category: "CONDO",
        ownershipType: "AGENT",
        ownerId,
        rentPrice: new Prisma.Decimal(rent),
        minRentPrice: new Prisma.Decimal(minRent),
        primaryAgentId: agentId,
        agents: { create: [{ userId: agentId, role: "LISTING" }] },
      },
    });
  actors.assetAId = (await mkAsset("PR-000101", ownerA.id, agentA.id, "20000.00", "18000.00")).id;
  actors.assetBId = (await mkAsset("PR-000102", ownerB.id, agentB.id, "35000.00", "31000.00")).id;

  const mkLead = (code: string, fullName: string, phone: string, ownerAgentId: string) =>
    prisma.lead.create({ data: { code, fullName, phone, source: "LINE", ownerAgentId } });
  actors.leadAId = (await mkLead("LD-000101", "สมชาย ใจดี", "+66812345678", agentA.id)).id;
  actors.leadBId = (await mkLead("LD-000102", "สมหญิง รักษ์ไทย", "+66823456789", agentB.id)).id;
});

afterAll(async () => {
  await app?.close();
});

describe("Matrix สิทธิ์ 4 บทบาท และ Data Scope", () => {
  it("การจัดการผู้ใช้และบทบาท (/users, /roles) เข้าได้เฉพาะ ADMIN", async () => {
    for (const path of ["/api/v1/users", "/api/v1/roles"]) {
      await http().get(path).set(auth(actors.adminToken)).expect(200);
      await http().get(path).set(auth(actors.managerAToken)).expect(403);
      await http().get(path).set(auth(actors.agentAToken)).expect(403);
      await http().get(path).set(auth(actors.accountingToken)).expect(403);
    }
  });

  it("การดูทีม (/teams): ADMIN เห็นทุกทีม, MANAGER เห็นเฉพาะทีมตัวเอง, AGENT/ACCOUNTING ได้ 403", async () => {
    const adminTeams = await http().get("/api/v1/teams").set(auth(actors.adminToken)).expect(200);
    expect(adminTeams.body.items.length).toBeGreaterThanOrEqual(2);
    const mgrTeams = await http().get("/api/v1/teams").set(auth(actors.managerAToken)).expect(200);
    expect(mgrTeams.body.items).toHaveLength(1);
    expect(mgrTeams.body.items[0].id).toBe(actors.teamAId);
    await http().get("/api/v1/teams").set(auth(actors.agentAToken)).expect(403);
    await http().get("/api/v1/teams").set(auth(actors.accountingToken)).expect(403);
  });

  it("Lead: Agent A เปิดดู/แก้ Lead ของ Agent B ไม่ได้ (403), Accounting ไม่มีสิทธิ์ lead.read (403)", async () => {
    const ownLead = await http().get(`/api/v1/leads/${actors.leadAId}`).set(auth(actors.agentAToken)).expect(200);
    expect(ownLead.body.phone).toBe("+66812345678");
    await http().get(`/api/v1/leads/${actors.leadBId}`).set(auth(actors.agentAToken)).expect(403);
    await http()
      .patch(`/api/v1/leads/${actors.leadBId}`)
      .set(auth(actors.agentAToken))
      .send({ specialNote: "x" })
      .expect(403);
    await http().get(`/api/v1/leads/${actors.leadAId}`).set(auth(actors.managerAToken)).expect(200);
    await http().get(`/api/v1/leads/${actors.leadBId}`).set(auth(actors.managerAToken)).expect(403);
    await http().get("/api/v1/leads").set(auth(actors.accountingToken)).expect(403);
  });

  it("Lead list (D16): ปิดบังเบอร์ในรายการ (08x-xxx-xxxx) และแสดงชื่อย่อสำหรับ Lead ของคนอื่นเมื่อค้นซ้ำ", async () => {
    const list = await http().get("/api/v1/leads?includeDirectory=true").set(auth(actors.agentAToken)).expect(200);
    const itemA = list.body.items.find((l: { id: string }) => l.id === actors.leadAId);
    const itemB = list.body.items.find((l: { id: string }) => l.id === actors.leadBId);
    expect(itemA).toMatchObject({ fullName: "สมชาย ใจดี", phone: "08x-xxx-5678", isOwn: true });
    expect(itemB).toMatchObject({ fullName: "สมหญิง ร.", phone: "08x-xxx-6789", isOwn: false });
  });

  it("Asset field-level & D15: Agent A เห็น minRentPrice เฉพาะห้องที่ตัวเองดูแล; Manager แก้ห้องทีมอื่นไม่ได้", async () => {
    const ownAsset = await http().get(`/api/v1/assets/${actors.assetAId}`).set(auth(actors.agentAToken)).expect(200);
    expect(ownAsset.body.minRentPrice).toBe("18000.00");
    expect(ownAsset.body.owner.phone).toBe("+66811112222");
    const otherAsset = await http().get(`/api/v1/assets/${actors.assetBId}`).set(auth(actors.agentAToken)).expect(200);
    expect(otherAsset.body.minRentPrice).toBeNull();
    expect(otherAsset.body.owner.phone).toBeNull();
    expect(otherAsset.body.owner.lineId).toBeNull();

    const mgrViewB = await http().get(`/api/v1/assets/${actors.assetBId}`).set(auth(actors.managerAToken)).expect(200);
    expect(mgrViewB.body.minRentPrice).toBe("31000.00");
    await http()
      .patch(`/api/v1/assets/${actors.assetAId}`)
      .set(auth(actors.managerAToken))
      .send({ internalNote: "ok" })
      .expect(200);
    await http()
      .patch(`/api/v1/assets/${actors.assetBId}`)
      .set(auth(actors.managerAToken))
      .send({ internalNote: "no" })
      .expect(403);
  });

  it("Admin ปิดสิทธิ์ lead.write ของ AGENT → agentA แก้ลูกค้าไม่ได้ทันที และ Admin รีเซ็ต 2FA ผู้ใช้อื่นได้พร้อม audit", async () => {
    const rolesRes = await http().get("/api/v1/roles").set(auth(actors.adminToken)).expect(200);
    const agentRole = rolesRes.body.roles.find((r: { code: string }) => r.code === "AGENT");
    const withoutLeadWrite = (agentRole.permissions as Array<{ code: string; scope: string }>).filter(
      (p) => p.code !== "lead.write",
    );
    await http()
      .put(`/api/v1/roles/${agentRole.id}/permissions`)
      .set(auth(actors.adminToken))
      .send({ permissions: withoutLeadWrite })
      .expect(200);
    await http()
      .patch(`/api/v1/leads/${actors.leadAId}`)
      .set(auth(actors.agentAToken))
      .send({ specialNote: "x" })
      .expect(403);
    await http()
      .put(`/api/v1/roles/${agentRole.id}/permissions`)
      .set(auth(actors.adminToken))
      .send({ permissions: agentRole.permissions })
      .expect(200);
    await http()
      .patch(`/api/v1/leads/${actors.leadAId}`)
      .set(auth(actors.agentAToken))
      .send({ specialNote: "ok" })
      .expect(200);

    await prisma.user.update({ where: { id: actors.agentBId }, data: { totpEnabled: true, totpSecret: "enc" } });
    await http().post(`/api/v1/users/${actors.agentBId}/reset-mfa`).set(auth(actors.adminToken)).expect(200);
    const updatedB = await prisma.user.findUniqueOrThrow({ where: { id: actors.agentBId } });
    expect(updatedB.totpEnabled).toBe(false);
    expect(updatedB.totpSecret).toBeNull();
  });
});
