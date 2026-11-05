import { expect, test } from "@playwright/test";
import { API_BASE, SEED_PASS, apiLogin, authHeader, createOwnerAndTwoAssets } from "./acceptance-api.helper";

test.describe("P18 · E2E สายงานหลักตามเกณฑ์ตรวจรับงาน (SRS ข้อ 9)", () => {
  test("สร้าง Owner & Agent Assets → Lead → Match → นัดดู 2 ห้อง → ติดตามผล → จอง → สัญญา → ค่านายหน้า 30/20/30/20 → อนุมัติ → รับเงิน → จ่าย Agent → ตรวจ Dashboard & รายงาน", async ({
    page,
    request,
  }) => {
    const sfx = Date.now();
    const agentAToken = await apiLogin(request, "agent1@rrs.local");
    const agentBToken = await apiLogin(request, "agent2@rrs.local");
    const mgrToken = await apiLogin(request, "manager1@rrs.local");
    const accToken = await apiLogin(request, "accounting2@rrs.local");

    const meA = (await (
      await request.get(`${API_BASE}/api/v1/auth/me`, { headers: authHeader(agentAToken) })
    ).json()) as { id: string };
    const meB = (await (
      await request.get(`${API_BASE}/api/v1/auth/me`, { headers: authHeader(agentBToken) })
    ).json()) as { id: string };

    // 1. สร้างเจ้าของทรัพย์ + ห้อง OWNER และห้อง AGENT
    const { ownerAsset, agentAsset } = await createOwnerAndTwoAssets(request, agentAToken, sfx);
    expect(ownerAsset.id).toBeTruthy();
    expect(agentAsset.id).toBeTruthy();

    // 2. สร้าง Lead + จับคู่ห้อง + สร้างรายการเสนอห้อง
    const leadRes = await request.post(`${API_BASE}/api/v1/leads`, {
      headers: authHeader(agentAToken),
      data: {
        intent: "RENT",
        fullName: `ลูกค้า E2E ${sfx}`,
        phone: `082${String(sfx).slice(-7)}`,
        source: "LINE",
        budgetMin: 25000,
        budgetMax: 35000,
        preferredCategory: "CONDO",
      },
    });
    expect(leadRes.status()).toBe(201);
    const lead = (await leadRes.json()) as { id: string };

    const matchRes = await request.get(`${API_BASE}/api/v1/leads/${lead.id}/matches`, {
      headers: authHeader(agentAToken),
    });
    expect(matchRes.status()).toBe(200);

    const offerRes = await request.post(`${API_BASE}/api/v1/leads/${lead.id}/offers`, {
      headers: authHeader(agentAToken),
      data: { items: [{ assetId: ownerAsset.id }, { assetId: agentAsset.id }] },
    });
    expect(offerRes.status()).toBe(201);

    // 3. นัดดู 2 ห้อง + บันทึกผลติดตามครบทั้ง 2 ห้อง
    const apptStart = new Date(Date.now() + 86_400_000 * 3).toISOString();
    const apptEnd = new Date(Date.now() + 86_400_000 * 3 + 3_600_000).toISOString();
    const apptRes = await request.post(`${API_BASE}/api/v1/appointments`, {
      headers: authHeader(agentAToken),
      data: {
        leadId: lead.id,
        startsAt: apptStart,
        endsAt: apptEnd,
        location: "ล็อบบี้ อาคาร A",
        assetIds: [ownerAsset.id, agentAsset.id],
        confirmOverlap: true,
      },
    });
    expect(apptRes.status()).toBe(201);
    const apptBody = (await apptRes.json()) as { appointment: { id: string } };
    const appt = apptBody.appointment;

    const followUpRes = await request.patch(`${API_BASE}/api/v1/appointments/${appt.id}/status`, {
      headers: authHeader(agentAToken),
      data: {
        status: "COMPLETED",
        nextFollowUpAt: new Date(Date.now() + 86_400_000 * 5).toISOString(),
        outcomes: [
          { assetId: ownerAsset.id, outcome: "CONSIDERING", outcomeNote: "ชอบวิวแต่เปรียบเทียบห้อง" },
          { assetId: agentAsset.id, outcome: "AGREED", outcomeNote: "ตกลงจองห้องนี้" },
        ],
      },
    });
    expect(followUpRes.status()).toBe(200);

    // 4. จอง + ชำระเงินจอง → ออกสัญญาเช่าและลงนาม
    const bookingRes = await request.post(`${API_BASE}/api/v1/bookings`, {
      headers: authHeader(agentAToken),
      data: {
        leadId: lead.id,
        assetId: agentAsset.id,
        monthlyRent: 30000,
        bookingFee: 10000,
        securityDeposit: 60000,
        advanceRent: 30000,
        startDate: "2027-05-01",
        endDate: "2028-04-30",
        payImmediately: true,
        paymentMethod: "BANK_TRANSFER",
      },
    });
    expect(bookingRes.status()).toBe(201);
    const booking = (await bookingRes.json()) as { id: string; status: string };
    expect(booking.status).toBe("PAID");

    const contractRes = await request.post(`${API_BASE}/api/v1/contracts`, {
      headers: authHeader(agentAToken),
      data: {
        bookingId: booking.id,
        commissionFormula: "ONE_MONTH",
        parties: [{ partyType: "TENANT", fullName: `ลูกค้า E2E ${sfx}`, phone: `082${String(sfx).slice(-7)}` }],
      },
    });
    expect(contractRes.status()).toBe(201);
    const contract = (await contractRes.json()) as { id: string };

    const signRes = await request.post(`${API_BASE}/api/v1/contracts/${contract.id}/sign`, {
      headers: authHeader(agentAToken),
      data: { signedAt: new Date().toISOString(), commissionFormula: "ONE_MONTH" },
    });
    expect([200, 201]).toContain(signRes.status());
    const signedContract = (await signRes.json()) as { commission: { id: string } };
    const commissionId = signedContract.commission.id;

    // 5. คำนวณค่านายหน้า + แบ่ง 30/20/30/20 → Manager อนุมัติ → รับเงินจากเจ้าของ → จ่าย Agent
    const splitRes = await request.put(`${API_BASE}/api/v1/commissions/${commissionId}/splits`, {
      headers: authHeader(mgrToken),
      data: {
        formula: "ONE_MONTH",
        baseAmount: "30000.00",
        termMonths: 12,
        splits: [
          { role: "FINDER", userId: meA.id, shareType: "PERCENT", sharePercent: "30" },
          { role: "LISTING", userId: meA.id, shareType: "PERCENT", sharePercent: "20" },
          { role: "CLOSER", userId: meB.id, shareType: "PERCENT", sharePercent: "30" },
          { role: "COMPANY", userId: null, shareType: "PERCENT", sharePercent: "20" },
        ],
      },
    });
    expect(splitRes.status()).toBe(200);

    const approveRes = await request.post(`${API_BASE}/api/v1/commissions/${commissionId}/approve`, {
      headers: authHeader(accToken),
      data: { note: "อนุมัติตามเกณฑ์ตรวจรับ E2E" },
    });
    expect([200, 201]).toContain(approveRes.status());

    const receiveRes = await request.post(`${API_BASE}/api/v1/commissions/${commissionId}/receive`, {
      headers: authHeader(accToken),
      data: { amount: "30000.00", method: "BANK_TRANSFER", reference: `REF-${sfx}` },
    });
    expect([200, 201]).toContain(receiveRes.status());
    const receivedComm = (await receiveRes.json()) as { splits: Array<{ id: string; userId: string | null }> };
    const agentASplitIds = receivedComm.splits.filter((s) => s.userId === meA.id).map((s) => s.id);

    const payoutRes = await request.post(`${API_BASE}/api/v1/commissions/payouts`, {
      headers: authHeader(accToken),
      data: {
        userId: meA.id,
        periodLabel: `รอบ E2E-${sfx}`,
        splitIds: agentASplitIds,
        payImmediately: true,
        method: "BANK_TRANSFER",
      },
    });
    expect(payoutRes.status()).toBe(201);

    // 6. ตรวจสอบยอดใน Dashboard และรายงานว่าตรงกัน และเปิดหน้า UI ยืนยันการแสดงผล
    const dashRes = await request.get(`${API_BASE}/api/v1/reports/dashboard?startDate=2026-01-01&endDate=2028-12-31`, {
      headers: authHeader(mgrToken),
    });
    const reportRes = await request.get(
      `${API_BASE}/api/v1/reports/summary?groupBy=PERIOD&startDate=2026-01-01&endDate=2028-12-31`,
      { headers: authHeader(mgrToken) },
    );
    const dashBody = (await dashRes.json()) as { financials: { totalCommission: string; companyNetIncome: string } };
    const reportBody = (await reportRes.json()) as { totals: { totalCommission: string; companyNetIncome: string } };
    expect(dashBody.financials).toEqual(reportBody.totals);

    await page.goto("/login");
    await page.getByLabel("อีเมล").fill("manager1@rrs.local");
    await page.getByLabel("รหัสผ่าน").fill(SEED_PASS);
    await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
    await expect(page.getByRole("heading", { name: "ภาพรวม" })).toBeVisible();
  });
});
