import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExecutiveDashboardView } from "./executive-dashboard-view";
import { ReportsHubView } from "./reports-hub-view";

const apiMock = vi.fn();

vi.mock("@/lib/api", () => ({
  api: (...args: unknown[]) => apiMock(...args),
}));

const sampleDashboard = {
  topKpis: [
    { code: "COMPANY_NET_INCOME", label: "รายได้สุทธิบริษัท", value: "30000.00" },
    { code: "TOTAL_COMMISSION", label: "ค่านายหน้ารวม", value: "30000.00" },
    { code: "OWNER_NET_INCOME", label: "รายได้สุทธิห้อง Owner", value: "23000.00" },
    { code: "CLOSED_DEALS_FUNNEL", label: "จำนวนดีลปิดและอัตราปิด Funnel", value: "2 ดีล (100%)" },
    { code: "RECEIVABLES_PAYABLES", label: "ยอดค้างรับ / ค้างจ่าย", value: "0.00 / 22500.00" },
  ],
  assetsByStatus: {
    AVAILABLE: 2,
    BOOKED: 0,
    CONTRACTED: 1,
    UNAVAILABLE: 0,
  },
  totalAssets: 3,
  funnel: {
    newLeads: 2,
    viewings: 2,
    bookingsAndOffers: 1,
    closedDeals: 2,
    conversionRatePercent: "100.0",
  },
  financials: {
    dealsCount: 2,
    ownerRevenue: "25000.00",
    ownerExpense: "2000.00",
    ownerNetIncome: "23000.00",
    totalCommission: "30000.00",
    agentShare: "22500.00",
    companyCommissionShare: "7500.00",
    companyNetIncome: "30500.00",
    receivables: "0.00",
    payables: "22500.00",
  },
};

const sampleSummary = {
  groupBy: "PERIOD" as const,
  granularity: "MONTH" as const,
  buckets: [
    {
      key: "2026-10",
      label: "2026-10",
      dealsCount: 2,
      ownerRevenue: "25000.00",
      ownerExpense: "2000.00",
      ownerNetIncome: "23000.00",
      totalCommission: "30000.00",
      agentShare: "22500.00",
      companyCommissionShare: "7500.00",
      companyNetIncome: "30500.00",
      receivables: "0.00",
      payables: "22500.00",
    },
  ],
  totals: {
    dealsCount: 2,
    ownerRevenue: "25000.00",
    ownerExpense: "2000.00",
    ownerNetIncome: "23000.00",
    totalCommission: "30000.00",
    agentShare: "22500.00",
    companyCommissionShare: "7500.00",
    companyNetIncome: "30500.00",
    receivables: "0.00",
    payables: "22500.00",
  },
};

describe("Dashboard & Reports Hub UI (P16)", () => {
  beforeEach(() => {
    apiMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders ExecutiveDashboardView with 5 Top KPIs, asset status bars, and funnel metrics", async () => {
    apiMock.mockImplementation((url: string) => {
      if (url.startsWith("/api/v1/reports/dashboard")) return Promise.resolve(sampleDashboard);
      if (url === "/api/v1/reports/filter-options") {
        return Promise.resolve({
          teams: [{ id: "t-1", name: "ทีมสุขุมวิท" }],
          projects: [{ id: "p-1", name: "โครงการสุขุมวิท" }],
        });
      }
      return Promise.resolve({});
    });

    render(<ExecutiveDashboardView />);

    await waitFor(() => {
      expect(screen.getByTestId("kpi-COMPANY_NET_INCOME")).toBeTruthy();
    });

    expect(screen.getByTestId("kpi-COMPANY_NET_INCOME").textContent).toContain("30000.00");
    expect(screen.getByTestId("kpi-TOTAL_COMMISSION").textContent).toContain("30000.00");
    expect(screen.getByTestId("kpi-OWNER_NET_INCOME").textContent).toContain("23000.00");
    expect(screen.getByTestId("kpi-CLOSED_DEALS_FUNNEL").textContent).toContain("2 ดีล (100%)");
    expect(screen.getByTestId("kpi-RECEIVABLES_PAYABLES").textContent).toContain("0.00 / 22500.00");

    const availableBar = screen.getByTestId("status-bar-AVAILABLE");
    expect(availableBar.getAttribute("style")).toContain("var(--color-status-available)");
  });

  it("renders ReportsHubView, hides Export buttons without report.export permission, and exports when permitted", async () => {
    apiMock.mockImplementation((url: string) => {
      if (url.startsWith("/api/v1/reports/summary")) return Promise.resolve(sampleSummary);
      if (url === "/api/v1/reports/filter-options") {
        return Promise.resolve({ teams: [], projects: [] });
      }
      if (url.startsWith("/api/v1/reports/export")) return Promise.resolve("csv-data");
      return Promise.resolve({});
    });

    const { unmount } = render(<ReportsHubView canExportOverride={false} />);

    await waitFor(() => {
      expect(screen.getByText("2026-10")).toBeTruthy();
    });

    expect(screen.queryByRole("button", { name: "Export CSV" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Export Excel" })).toBeNull();
    unmount();

    render(<ReportsHubView canExportOverride={true} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Export CSV" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith(expect.stringContaining("/api/v1/reports/export"));
    });
  });
});
