import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OwnerFinanceView } from "./owner-finance-view";

const apiFetchMock = vi.fn();

vi.mock("@/lib/api", () => ({
  api: (...args: unknown[]) => apiFetchMock(...args),
}));

afterEach(() => {
  cleanup();
});

const SAMPLE_REPORT = {
  year: 2027,
  months: ["2027-01"],
  rooms: [
    {
      assetId: "asset-own-1",
      assetCode: "PR-OWN-001",
      unitNo: "101",
      category: "CONDO",
      monthly: [
        {
          month: "2027-01",
          contractRent: "25000.50",
          contractRentSatang: "2500050",
          rentCollected: "25000.50",
          rentCollectedSatang: "2500050",
          otherIncome: "1250.25",
          otherIncomeSatang: "125025",
          commissionPaid: "25000.50",
          commissionPaidSatang: "2500050",
          expenses: "1800.00",
          expensesSatang: "180000",
          netIncome: "-549.75",
          netIncomeSatang: "-54975",
        },
      ],
      totals: {
        month: "2027-TOTAL",
        contractRent: "300006.00",
        contractRentSatang: "30000600",
        rentCollected: "300006.00",
        rentCollectedSatang: "30000600",
        otherIncome: "1751.00",
        otherIncomeSatang: "175100",
        commissionPaid: "25000.50",
        commissionPaidSatang: "2500050",
        expenses: "29251.25",
        expensesSatang: "2925125",
        netIncome: "247505.25",
        netIncomeSatang: "24750525",
      },
    },
  ],
  grandTotals: {
    month: "2027-TOTAL",
    contractRent: "300006.00",
    contractRentSatang: "30000600",
    rentCollected: "990018.50",
    rentCollectedSatang: "99001850",
    otherIncome: "3751.00",
    otherIncomeSatang: "375100",
    commissionPaid: "76501.63",
    commissionPaidSatang: "7650163",
    expenses: "45202.85",
    expensesSatang: "4520285",
    netIncome: "872065.02",
    netIncomeSatang: "87206502",
  },
};

const SAMPLE_SCHEDULES = [
  {
    id: "sched-1",
    contractId: "con-1",
    periodStart: "2027-01-01",
    periodEnd: "2027-01-31",
    dueDate: "2027-01-01",
    amountDue: "25000.50",
    amountPaid: "10000.25",
    status: "PARTIAL",
    contract: {
      id: "con-1",
      contractNo: "LS-2027-0001",
      asset: { id: "asset-own-1", code: "PR-OWN-001", unitNo: "101" },
      lead: { id: "lead-1", code: "LD-000001", fullName: "สมชาย ผู้เช่า" },
    },
  },
];

describe("OwnerFinanceView (P13)", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation(async (path: string, opts?: { method?: string }) => {
      if (path.includes("/finance/reports/owner-net-income")) return SAMPLE_REPORT;
      if (path.includes("/finance/rent-schedules")) return SAMPLE_SCHEDULES;
      if (path.includes("/finance/expenses") && (!opts || !opts.method)) {
        return [
          {
            id: "exp-1",
            assetId: "asset-own-1",
            category: "COMMON_FEE",
            amount: "1800.00",
            incurredAt: "2027-01-10",
            paidAt: "2027-01-10",
            vendor: "นิติบุคคล",
            note: null,
            asset: { id: "asset-own-1", code: "PR-OWN-001", unitNo: "101" },
          },
        ];
      }
      if (path.includes("/assets")) return { items: [{ id: "asset-own-1", code: "PR-OWN-001", unitNo: "101" }] };
      return { id: "ok" };
    });
  });

  it("แสดงรายงานรายได้สุทธิต่อห้องต่อเดือนโดยไม่ใช้ float และสลับไปแท็บงวดค่าเช่าเพื่อรับชำระได้", async () => {
    render(<OwnerFinanceView />);

    await waitFor(() => {
      expect(screen.getByTestId("grand-net-income")).toHaveTextContent("872,065.02 ฿");
    });
    expect(screen.getByText(/PR-OWN-001/)).toBeInTheDocument();
    expect(screen.getByText("-549.75")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "งวดค่าเช่า & ค่าใช้จ่าย" }));

    await waitFor(() => {
      expect(screen.getByText("LS-2027-0001")).toBeInTheDocument();
    });
    expect(screen.getByText("ชำระบางส่วน")).toBeInTheDocument();
    expect(screen.getByText("ค่าส่วนกลาง")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "รับชำระ" }));
    expect(screen.getByDisplayValue("15000.25")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "ยืนยันรับเงิน" }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/v1/finance/payments",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });
});
