import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DealsWorkspace } from "./deals-workspace";

const mockApi = vi.fn();

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: (...args: unknown[]) => mockApi(...args),
  };
});

describe("P12 · DealsWorkspace (ContractsTab & SaleDealsTab)", () => {
  beforeEach(() => {
    mockApi.mockReset();
    mockApi.mockImplementation((path: string, init?: RequestInit) => {
      if (path.startsWith("/api/v1/bookings")) {
        return Promise.resolve([]);
      }
      if (path.startsWith("/api/v1/contracts") && (!init || !init.method || init.method === "GET")) {
        return Promise.resolve([
          {
            id: "ct-1",
            contractNo: "LS-2027-0001",
            revision: 1,
            revisionOfId: null,
            previousContractId: null,
            bookingId: "bk-1",
            assetId: "as-1",
            leadId: "ld-1",
            ownerId: "ow-1",
            monthlyRent: 25000,
            securityDeposit: 50000,
            advanceRent: 25000,
            startDate: "2027-01-01",
            endDate: "2027-12-31",
            status: "ACTIVE",
            signedAt: "2027-01-01T10:00:00.000Z",
            terminatedAt: null,
            terminationReason: null,
            note: "สัญญาเช่า 1 ปี",
            lead: {
              id: "ld-1",
              code: "LD-000001",
              fullName: "คุณสมหญิง ใจดี",
              phone: "0812345678",
              status: "CONTRACTED",
            },
            asset: {
              id: "as-1",
              code: "PR-000101",
              category: "CONDO",
              unitNo: "20/1",
              status: "CONTRACTED",
              project: { id: "pj-1", name: "ไอดีโอ สุขุมวิท" },
            },
            owner: { id: "ow-1", code: "OW-000001", fullName: "เจ้าของ P12" },
            booking: { id: "bk-1", code: "BK-000001", status: "CONVERTED" },
            revisionOf: null,
            previousContract: null,
            commission: { id: "cm-1", status: "PENDING_CALC", formula: "ONE_MONTH", baseAmount: 25000 },
          },
        ]);
      }
      if (path === "/api/v1/contracts/ct-1" && init?.method === "PATCH") {
        return Promise.resolve({ id: "ct-2", contractNo: "LS-2027-0001-R2", revision: 2 });
      }
      if (path.startsWith("/api/v1/sale-deals") && (!init || !init.method || init.method === "GET")) {
        return Promise.resolve([
          {
            id: "sd-1",
            code: "SD-000001",
            leadId: "ld-2",
            assetId: "as-2",
            ownerId: "ow-1",
            agentId: "ag-1",
            stage: "OFFERED",
            askingPrice: 8500000,
            offeredPrice: 8200000,
            agreedPrice: null,
            depositAmount: null,
            spaSignedAt: null,
            transferDate: null,
            transferFeePayer: null,
            loanBank: null,
            cancelReason: null,
            note: null,
            lead: {
              id: "ld-2",
              code: "LD-000002",
              fullName: "คุณวิชัย นักลงทุน",
              phone: "0899999999",
              status: "NEGOTIATING",
            },
            asset: {
              id: "as-2",
              code: "PR-000102",
              category: "HOUSE",
              unitNo: "99/9",
              salePrice: 8500000,
              status: "NEGOTIATING",
              project: null,
            },
            agent: { id: "ag-1", fullName: "สมชาย", nickname: "ชาย" },
            commission: null,
          },
        ]);
      }
      if (path === "/api/v1/sale-deals/sd-1" && init?.method === "PATCH") {
        return Promise.resolve({ id: "sd-1", stage: "CLOSED" });
      }
      return Promise.resolve({});
    });
  });

  it("สลับแท็บ สัญญาเช่า แสดง LS-2027-0001 และสร้าง Revision ใหม่ได้", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <DealsWorkspace />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "สัญญาเช่า (Lease Contracts)" }));
    await waitFor(() => expect(screen.getByTestId("contract-card-LS-2027-0001")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /แก้ไข \(สร้าง Revision\)/ }));
    await waitFor(() => expect(screen.getByText(/สร้าง Revision ใหม่ \(LS-2027-0001\)/)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("ค่าเช่าต่อเดือนใหม่"), { target: { value: "23000" } });
    fireEvent.click(screen.getByRole("button", { name: "บันทึก Revision" }));

    await waitFor(() => {
      const patchCalls = mockApi.mock.calls.filter(
        ([p, init]) => p === "/api/v1/contracts/ct-1" && (init as RequestInit)?.method === "PATCH",
      );
      expect(patchCalls).toHaveLength(1);
      const body = JSON.parse(String((patchCalls[0]![1] as RequestInit).body));
      expect(body.monthlyRent).toBe(23000);
    });
  });

  it("สลับแท็บ งานขาย แสดง SD-000001 และเปลี่ยนสถานะเป็น ปิดการขาย พร้อมระบุผู้จ่ายค่าธรรมเนียมโอนได้", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <DealsWorkspace />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "งานขาย (Sale Pipeline)" }));
    await waitFor(() => expect(screen.getByTestId("sale-deal-card-SD-000001")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("เปลี่ยนสถานะดีล SD-000001"), { target: { value: "CLOSED" } });
    fireEvent.change(screen.getByLabelText("ค่าธรรมเนียมโอน SD-000001"), { target: { value: "SPLIT" } });

    await waitFor(() => {
      const patchCalls = mockApi.mock.calls.filter(
        ([p, init]) => p === "/api/v1/sale-deals/sd-1" && (init as RequestInit)?.method === "PATCH",
      );
      expect(patchCalls.length).toBeGreaterThanOrEqual(2);
    });
  });
});
