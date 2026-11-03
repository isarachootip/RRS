import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommissionsView } from "./commissions-view";
import type { CommissionRecord } from "./commissions.types";

const MOCK_COMMISSIONS: CommissionRecord[] = [
  {
    id: "com-1",
    contractId: "con-1",
    saleDealId: null,
    assetId: "ast-1",
    ownershipType: "AGENT",
    formula: "ONE_MONTH",
    params: {},
    baseAmount: "30000.00",
    termMonths: 12,
    totalAmount: "30000.00",
    status: "APPROVED",
    currentRevision: 1,
    approvedAt: "2026-11-01T10:00:00.000Z",
    ownerPaymentDueAt: null,
    receivedAt: null,
    asset: {
      id: "ast-1",
      code: "PR-000101",
      unitNo: "12A",
      ownershipType: "AGENT",
      primaryAgent: { id: "ag-b", fullName: "Agent B" },
      agents: [],
    },
    contract: {
      id: "con-1",
      contractNo: "LS-2026-0001",
      monthlyRent: "30000.00",
      lead: { id: "ld-1", code: "LD-001", fullName: "คุณสมชาย", ownerAgent: { id: "ag-a", fullName: "Agent A" } },
    },
    saleDeal: null,
    splits: [],
    currentSplits: [
      {
        id: "sp-1",
        commissionId: "com-1",
        revision: 1,
        role: "FINDER",
        userId: "ag-a",
        shareType: "PERCENT",
        sharePercent: "30.00",
        amount: "9000.00",
        withholdingTax: "0.00",
        netAmount: "9000.00",
        payoutId: null,
        user: { id: "ag-a", fullName: "Agent A" },
      },
      {
        id: "sp-2",
        commissionId: "com-1",
        revision: 1,
        role: "LISTING",
        userId: "ag-b",
        shareType: "PERCENT",
        sharePercent: "20.00",
        amount: "6000.00",
        withholdingTax: "0.00",
        netAmount: "6000.00",
        payoutId: null,
        user: { id: "ag-b", fullName: "Agent B" },
      },
      {
        id: "sp-3",
        commissionId: "com-1",
        revision: 1,
        role: "CLOSER",
        userId: "ag-c",
        shareType: "PERCENT",
        sharePercent: "30.00",
        amount: "9000.00",
        withholdingTax: "0.00",
        netAmount: "9000.00",
        payoutId: null,
        user: { id: "ag-c", fullName: "Agent C" },
      },
      {
        id: "sp-4",
        commissionId: "com-1",
        revision: 1,
        role: "COMPANY",
        userId: null,
        shareType: "PERCENT",
        sharePercent: "20.00",
        amount: "6000.00",
        withholdingTax: "0.00",
        netAmount: "6000.00",
        payoutId: null,
      },
    ],
    suggestedSplits: [
      { role: "FINDER", userId: "ag-a", shareType: "PERCENT", sharePercent: "30.00" },
      { role: "LISTING", userId: "ag-b", shareType: "PERCENT", sharePercent: "20.00" },
      { role: "CLOSER", userId: "ag-c", shareType: "PERCENT", sharePercent: "30.00" },
      { role: "COMPANY", userId: null, shareType: "PERCENT", sharePercent: "20.00" },
    ],
    revisions: [
      {
        id: "rev-1",
        revision: 1,
        reason: null,
        createdAt: "2026-11-01T10:00:00.000Z",
        approvedAt: "2026-11-01T10:05:00.000Z",
        snapshot: {
          formula: "ONE_MONTH",
          baseAmount: "30000.00",
          totalAmount: "30000.00",
          splits: [],
        },
      },
    ],
  },
];

vi.mock("@/lib/api", () => ({
  api: vi.fn(async (url: string) => {
    if (url.includes("/payouts")) return [];
    return MOCK_COMMISSIONS;
  }),
}));

describe("CommissionsView & CommissionSplitModal (P15)", () => {
  afterEach(() => cleanup());

  it("แสดงรายการค่านายหน้า คำนวณสด 30/20/30/20 = 9,000/6,000/9,000/6,000 และบล็อกเมื่อเกิน 110% หรือไม่ใส่เหตุผลหลังอนุมัติ", async () => {
    render(<CommissionsView />);

    await waitFor(() => {
      expect(screen.getByText(/PR-000101/)).toBeDefined();
    });

    fireEvent.click(screen.getByText("คำนวณ/แก้ไขส่วนแบ่ง"));

    expect(screen.getByTestId("live-total-baht").textContent).toBe("30000.00");
    expect(screen.getAllByText("9000.00").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("6000.00").length).toBeGreaterThanOrEqual(2);

    const saveBtn = screen.getByText("บันทึกการคำนวณ") as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);

    const finderInput = screen.getByLabelText("เปอร์เซ็นต์-FINDER");
    fireEvent.change(finderInput, { target: { value: "40" } });

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain("10.00%");
    });
    expect(saveBtn.disabled).toBe(true);

    fireEvent.click(screen.getByText("ใช้เทมเพลต 30/20/30/20"));
    fireEvent.change(screen.getByLabelText("เหตุผลการแก้ไขหลังอนุมัติ"), {
      target: { value: "ปรับส่วนแบ่งตามข้อตกลงใหม่" },
    });

    await waitFor(() => {
      expect(saveBtn.disabled).toBe(false);
    });
  });
});
