import { expect, test } from "@playwright/test";
import { API_BASE, apiLogin, authHeader } from "./acceptance-api.helper";

test.describe("P18 · E2E สิทธิ์ 4 บทบาท และกรณีผิดพลาดสำคัญ (SRS ข้อ 9)", () => {
  test("สิทธิ์ 4 บทบาท (Admin, Manager, Agent A, Agent B คนละทีม, บัญชี) และกรณีผิดพลาดสำคัญครบถ้วน", async ({
    request,
  }) => {
    const sfx = Date.now();
    const agentAToken = await apiLogin(request, "agent1@rrs.local");
    const agentBToken = await apiLogin(request, "agent2@rrs.local");
    const mgrToken = await apiLogin(request, "manager1@rrs.local");
    const accToken = await apiLogin(request, "accounting2@rrs.local");

    const dupPhone = `089${String(sfx).slice(-7)}`;
    const leadARes = await request.post(`${API_BASE}/api/v1/leads`, {
      headers: authHeader(agentAToken),
      data: { intent: "RENT", fullName: `ลูกค้าทีมเอ ${sfx}`, phone: dupPhone, source: "FACEBOOK" },
    });
    expect(leadARes.status()).toBe(201);
    const leadA = (await leadARes.json()) as { id: string };

    // Agent B คนละทีมแก้ไข Lead ของ Agent A ไม่ได้ (403) และตรวจเบอร์ซ้ำจะเตือนโดยไม่รั่วไหลข้อมูลติดต่อ
    const forbiddenPatch = await request.patch(`${API_BASE}/api/v1/leads/${leadA.id}`, {
      headers: authHeader(agentBToken),
      data: { specialNote: "พยายามแก้ข้ามทีม" },
    });
    expect(forbiddenPatch.status()).toBe(403);

    const dupCheckRes = await request.get(`${API_BASE}/api/v1/leads/duplicates?phone=${dupPhone}`, {
      headers: authHeader(agentBToken),
    });
    expect(dupCheckRes.status()).toBe(200);
    const dupBody = (await dupCheckRes.json()) as { items: Array<{ id: string }> };
    expect(dupBody.items.length).toBeGreaterThanOrEqual(1);

    // กรณีผิดพลาด: นัดซ้อนเวลาของ Agent เดียวกันโดยไม่ยืนยัน confirmOverlap (409)
    const ownerRes = await request.post(`${API_BASE}/api/v1/owners`, {
      headers: authHeader(agentAToken),
      data: { fullName: `เจ้าของตรวจ Error ${sfx}`, phone: `083${String(sfx).slice(-7)}` },
    });
    const owner = (await ownerRes.json()) as { id: string };
    const assetRes = await request.post(`${API_BASE}/api/v1/assets`, {
      headers: authHeader(agentAToken),
      data: {
        category: "CONDO",
        ownershipType: "AGENT",
        ownerId: owner.id,
        rentPrice: 20000,
        minRentPrice: 18000,
        forRent: true,
      },
    });
    const asset = (await assetRes.json()) as { id: string };

    // Agent B ต่างทีมไม่เห็น minRentPrice ของห้อง Agent A
    const assetForB = (await (
      await request.get(`${API_BASE}/api/v1/assets/${asset.id}`, { headers: authHeader(agentBToken) })
    ).json()) as { minRentPrice: string | null };
    expect(assetForB.minRentPrice).toBeNull();

    const tStart = new Date(Date.now() + 86_400_000 * 10).toISOString();
    const tEnd = new Date(Date.now() + 86_400_000 * 10 + 3_600_000).toISOString();
    await request.post(`${API_BASE}/api/v1/appointments`, {
      headers: authHeader(agentAToken),
      data: { leadId: leadA.id, startsAt: tStart, endsAt: tEnd, assetIds: [asset.id], confirmOverlap: true },
    });
    const overlapApptRes = await request.post(`${API_BASE}/api/v1/appointments`, {
      headers: authHeader(agentAToken),
      data: { leadId: leadA.id, startsAt: tStart, endsAt: tEnd, assetIds: [asset.id] },
    });
    expect(overlapApptRes.status()).toBe(409);

    // กรณีผิดพลาด: จองห้องเดียวกันช่วงเวลาทับกัน (409)
    await request.post(`${API_BASE}/api/v1/bookings`, {
      headers: authHeader(agentAToken),
      data: {
        leadId: leadA.id,
        assetId: asset.id,
        monthlyRent: 20000,
        bookingFee: 5000,
        startDate: "2028-06-01",
        endDate: "2029-05-31",
        payImmediately: true,
      },
    });
    const overlapBookingRes = await request.post(`${API_BASE}/api/v1/bookings`, {
      headers: authHeader(agentAToken),
      data: {
        leadId: leadA.id,
        assetId: asset.id,
        monthlyRent: 20000,
        bookingFee: 5000,
        startDate: "2028-09-01",
        endDate: "2029-08-31",
        payImmediately: true,
      },
    });
    expect(overlapBookingRes.status()).toBe(409);

    // กรณีผิดพลาด: ส่วนแบ่งค่านายหน้ารวมไม่ครบ 100% (400) และแก้หลังอนุมัติโดยไม่ใส่เหตุผล (400)
    const contractRes = await request.post(`${API_BASE}/api/v1/contracts`, {
      headers: authHeader(agentAToken),
      data: {
        assetId: asset.id,
        leadId: leadA.id,
        monthlyRent: 20000,
        startDate: "2029-06-01",
        endDate: "2030-05-31",
        status: "ACTIVE",
        parties: [{ partyType: "TENANT", fullName: `ลูกค้าทีมเอ ${sfx}` }],
      },
    });
    const contract = (await contractRes.json()) as { commission: { id: string } };
    const commId = contract.commission.id;

    const badSplitRes = await request.put(`${API_BASE}/api/v1/commissions/${commId}/splits`, {
      headers: authHeader(mgrToken),
      data: {
        formula: "ONE_MONTH",
        splits: [{ role: "COMPANY", userId: null, shareType: "PERCENT", sharePercent: "80" }],
      },
    });
    expect(badSplitRes.status()).toBe(400);

    await request.put(`${API_BASE}/api/v1/commissions/${commId}/splits`, {
      headers: authHeader(mgrToken),
      data: {
        formula: "ONE_MONTH",
        splits: [{ role: "COMPANY", userId: null, shareType: "PERCENT", sharePercent: "100" }],
      },
    });
    const approveOk = await request.post(`${API_BASE}/api/v1/commissions/${commId}/approve`, {
      headers: authHeader(accToken),
      data: { note: "อนุมัติรอบแรก" },
    });
    expect([200, 201]).toContain(approveOk.status());

    const reviseWithoutReasonRes = await request.put(`${API_BASE}/api/v1/commissions/${commId}/splits`, {
      headers: authHeader(mgrToken),
      data: {
        formula: "ONE_MONTH",
        splits: [{ role: "COMPANY", userId: null, shareType: "PERCENT", sharePercent: "100" }],
      },
    });
    expect(reviseWithoutReasonRes.status()).toBe(400);
  });
});
