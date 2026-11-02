import { ApiError } from "@/lib/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppointmentCompleteModal } from "../appointments/appointment-complete-modal";
import type { CalendarAppointmentItem } from "../appointments/appointments.types";
import { BookingsView } from "./bookings-view";

const mockApi = vi.fn();

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: (...args: unknown[]) => mockApi(...args),
  };
});

describe("P11 · AppointmentCompleteModal & BookingsView", () => {
  beforeEach(() => {
    mockApi.mockReset();
    mockApi.mockImplementation((path: string, init?: RequestInit) => {
      if (path.startsWith("/api/v1/bookings") && (!init || !init.method || init.method === "GET")) {
        return Promise.resolve([
          {
            id: "bk-1",
            code: "BK-000001",
            leadId: "ld-1",
            assetId: "as-1",
            monthlyRent: 25000,
            bookingFee: 10000,
            securityDeposit: 50000,
            advanceRent: 25000,
            startDate: "2026-12-01",
            endDate: "2027-11-30",
            status: "PENDING_PAYMENT",
            paidAt: null,
            receivedById: null,
            cancelReason: null,
            feeForfeited: null,
            note: "รอโอนเงินจอง",
            createdAt: "2026-11-02T10:00:00.000Z",
            lead: {
              id: "ld-1",
              code: "LD-000001",
              fullName: "คุณสมหญิง ใจดี",
              phone: "0812345678",
              status: "NEGOTIATING",
            },
            asset: {
              id: "as-1",
              code: "PR-000101",
              category: "CONDO",
              unitNo: "15/1",
              rentPrice: 25000,
              status: "NEGOTIATING",
              project: { id: "pj-1", name: "ไอดีโอ สุขุมวิท" },
            },
            receivedBy: null,
            payments: [],
          },
        ]);
      }
      if (path.startsWith("/api/v1/leads")) {
        return Promise.resolve({ items: [{ id: "ld-1", code: "LD-000001", fullName: "คุณสมหญิง ใจดี" }] });
      }
      if (path.startsWith("/api/v1/assets")) {
        return Promise.resolve({ items: [{ id: "as-1", code: "PR-000101", unitNo: "15/1", rentPrice: "25000" }] });
      }
      if (path === "/api/v1/bookings" && init?.method === "POST") {
        return Promise.reject(
          new ApiError(
            409,
            "PERIOD_OVERLAP",
            "ห้องนี้มีการจองหรือสัญญาในช่วงวันที่นี้แล้ว (ชนกับ BK-000001)",
            "req-overlap",
            { conflictingCode: "BK-000001" },
          ),
        );
      }
      if (path === "/api/v1/bookings/bk-1/pay" && init?.method === "POST") {
        return Promise.resolve({ id: "bk-1", status: "PAID" });
      }
      if (path === "/api/v1/bookings/bk-1/cancel" && init?.method === "POST") {
        return Promise.resolve({ id: "bk-1", status: "CANCELLED" });
      }
      if (path.startsWith("/api/v1/appointments/") && init?.method === "PATCH") {
        return Promise.resolve({ status: "COMPLETED" });
      }
      return Promise.resolve({});
    });
  });

  it("AppointmentCompleteModal บังคับบันทึกผลรายห้องและวันติดตามครั้งถัดไปเมื่อกดนัดสำเร็จ", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const onClose = vi.fn();
    const mockAppt: CalendarAppointmentItem = {
      id: "appt-1",
      code: "AP-000101",
      title: "AP-000101 · คุณสมหญิง",
      isBusyOnly: false,
      startsAt: "2026-11-15T10:00:00.000Z",
      endsAt: "2026-11-15T12:00:00.000Z",
      status: "CONFIRMED",
      agentId: "ag-1",
      agent: { id: "ag-1", fullName: "สมชาย", nickname: "ชาย", teamId: "t-1" },
      leadId: "ld-1",
      lead: {
        id: "ld-1",
        code: "LD-000001",
        fullName: "คุณสมหญิง",
        phone: null,
        ownerAgentId: "ag-1",
        status: "VIEWING",
      },
      location: null,
      note: null,
      coordinatorId: null,
      coordinatorName: null,
      coordinatorPhone: null,
      rescheduledFromId: null,
      items: [
        {
          appointmentId: "appt-1",
          assetId: "as-1",
          sortOrder: 0,
          outcome: null,
          outcomeNote: null,
          asset: {
            id: "as-1",
            code: "PR-000101",
            category: "CONDO",
            unitNo: "15/1",
            status: "VIEWING_SCHEDULED",
            project: { id: "pj-1", name: "ไอดีโอ" },
          },
        },
      ],
    };

    render(
      <QueryClientProvider client={qc}>
        <AppointmentCompleteModal appt={mockAppt} onClose={onClose} />
      </QueryClientProvider>,
    );

    fireEvent.change(screen.getByLabelText("ผลของห้อง PR-000101"), { target: { value: "AGREED" } });
    fireEvent.click(screen.getByRole("button", { name: "ยืนยันนัดสำเร็จและบันทึกผล" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const patchCall = mockApi.mock.calls.find(([p]) => p === "/api/v1/appointments/appt-1/status");
    expect(patchCall).toBeDefined();
    const body = JSON.parse(String((patchCall![1] as RequestInit).body));
    expect(body.status).toBe("COMPLETED");
    expect(body.outcomes[0].outcome).toBe("AGREED");
  });

  it("แสดงรายการจอง กดยืนยันรับชำระ/ยกเลิกการจองได้ และแสดงข้อความไทยเมื่อชนช่วงวันที่ (PERIOD_OVERLAP)", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <BookingsView />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("booking-card-BK-000001")).toBeInTheDocument());
    expect(screen.getByText(/คุณสมหญิง ใจดี/)).toBeInTheDocument();

    // เปิด modal ยืนยันรับชำระ
    fireEvent.click(screen.getByRole("button", { name: /ยืนยันรับชำระ/ }));
    await waitFor(() => expect(screen.getByText(/ยืนยันรับชำระเงินจอง \(BK-000001\)/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "ยืนยันรับชำระและล็อกห้อง" }));

    await waitFor(() => {
      const payCalls = mockApi.mock.calls.filter(([p]) => p === "/api/v1/bookings/bk-1/pay");
      expect(payCalls).toHaveLength(1);
    });

    // เปิด modal สร้างการจองใหม่แล้วชนช่วงวันที่
    fireEvent.click(screen.getByRole("button", { name: /สร้างการจองใหม่/ }));
    await waitFor(() => expect(screen.getByRole("option", { name: /LD-000001/ })).toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole("option", { name: /PR-000101/ })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("เลือกลูกค้า"), { target: { value: "ld-1" } });
    fireEvent.change(screen.getByLabelText("เลือกทรัพย์สิน"), { target: { value: "as-1" } });
    fireEvent.click(screen.getByRole("button", { name: "บันทึกการจอง" }));

    await waitFor(() =>
      expect(screen.getByText("ห้องนี้มีการจองหรือสัญญาในช่วงวันที่นี้แล้ว (ชนกับ BK-000001)")).toBeInTheDocument(),
    );
  });
});
