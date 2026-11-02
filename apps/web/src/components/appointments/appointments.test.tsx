import { ApiError } from "@/lib/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppointmentsView } from "./appointments-view";

const mockApi = vi.fn();

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: (...args: unknown[]) => mockApi(...args),
  };
});

describe("P10 · AppointmentsView & AppointmentFormModal", () => {
  beforeEach(() => {
    mockApi.mockReset();
    const nowIso = new Date().toISOString();
    mockApi.mockImplementation((path: string, init?: RequestInit) => {
      if (path.startsWith("/api/v1/appointments/calendar")) {
        return Promise.resolve({
          items: [
            {
              id: "appt-own",
              code: "AP-000101",
              title: "AP-000101 · คุณสมหญิง ใจดี",
              isBusyOnly: false,
              startsAt: nowIso,
              endsAt: nowIso,
              status: "PENDING",
              agentId: "ag-1",
              agent: { id: "ag-1", fullName: "สมชาย เอเจนต์", nickname: "ชาย", teamId: "t-1" },
              leadId: "ld-1",
              lead: {
                id: "ld-1",
                code: "LD-000001",
                fullName: "คุณสมหญิง ใจดี",
                phone: "0812345678",
                ownerAgentId: "ag-1",
                status: "VIEWING",
              },
              location: "ล็อบบี้ อาคาร A",
              note: null,
              coordinatorId: null,
              coordinatorName: "นิติบุคคล",
              coordinatorPhone: null,
              rescheduledFromId: null,
              items: [
                {
                  appointmentId: "appt-own",
                  assetId: "as-1",
                  sortOrder: 0,
                  outcome: null,
                  outcomeNote: null,
                  asset: {
                    id: "as-1",
                    code: "PR-000101",
                    category: "CONDO",
                    unitNo: "12/88",
                    status: "VIEWING_SCHEDULED",
                    project: { id: "pj-1", name: "ไอดีโอ สุขุมวิท" },
                  },
                },
              ],
            },
            {
              id: "appt-other",
              code: null,
              title: "ไม่ว่าง",
              isBusyOnly: true,
              startsAt: nowIso,
              endsAt: nowIso,
              status: "CONFIRMED",
              agentId: "ag-2",
              agent: { id: "ag-2", fullName: "วิภา ทีมขาย", nickname: "วิ", teamId: "t-1" },
              leadId: null,
              lead: null,
              location: null,
              note: null,
              coordinatorId: null,
              coordinatorName: null,
              coordinatorPhone: null,
              rescheduledFromId: null,
              items: [],
            },
          ],
        });
      }
      if (path.startsWith("/api/v1/leads")) {
        return Promise.resolve({
          items: [{ id: "ld-1", code: "LD-000001", fullName: "คุณสมหญิง ใจดี" }],
        });
      }
      if (path.startsWith("/api/v1/assets")) {
        return Promise.resolve({
          items: [
            { id: "as-1", code: "PR-000101", unitNo: "12/88", project: { name: "ไอดีโอ สุขุมวิท" } },
            { id: "as-2", code: "PR-000102", unitNo: "15/99", project: { name: "แอชตัน อโศก" } },
          ],
        });
      }
      if (path === "/api/v1/agents") {
        return Promise.resolve({ items: [{ id: "ag-1", fullName: "สมชาย เอเจนต์", teamId: "t-1" }] });
      }
      if (path === "/api/v1/teams-options") {
        return Promise.resolve({ items: [{ id: "t-1", name: "ทีมสุขุมวิท" }] });
      }
      if (path === "/api/v1/appointments" && init?.method === "POST") {
        const body = JSON.parse(String(init.body));
        if (!body.confirmOverlap) {
          return Promise.reject(
            new ApiError(409, "APPOINTMENT_OVERLAP_WARNING", "พบนัดหมายซ้อน", "req-1", {
              overlaps: [
                {
                  id: "appt-own",
                  code: "AP-000101",
                  startsAt: nowIso,
                  endsAt: nowIso,
                  location: "ล็อบบี้ อาคาร A",
                  status: "PENDING",
                },
              ],
            }),
          );
        }
        return Promise.resolve({ appointment: { id: "appt-new", code: "AP-000102" }, overlapWarning: true });
      }
      return Promise.resolve({});
    });
  });

  it("แสดงปฏิทินทีม สลับมุมมอง วัน/สัปดาห์/เดือน ได้ และเห็นนัดคนอื่นเป็น 'ไม่ว่าง'", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <AppointmentsView />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(screen.getByText("AP-000101")).toBeInTheDocument());
    expect(screen.getByText("คุณสมหญิง ใจดี")).toBeInTheDocument();
    expect(screen.getByTestId("busy-slot")).toHaveTextContent("ไม่ว่าง");

    fireEvent.click(screen.getByRole("button", { name: "เดือน" }));
    await waitFor(() => expect(screen.getByTestId("team-calendar")).toHaveAttribute("data-view-mode", "month"));
  });

  it("สร้างนัดหลายห้อง พบนัดซ้อนจะแสดงคำเตือนและกดยืนยันบันทึกนัดซ้อนได้", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <AppointmentsView />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(screen.getByText("สร้างนัดดูห้อง")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /สร้างนัดดูห้อง/ }));

    await waitFor(() => expect(screen.getByText("PR-000101")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("ลูกค้าที่นัดดู"), { target: { value: "ld-1" } });

    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]!);
    fireEvent.click(checkboxes[1]!);

    fireEvent.click(screen.getByRole("button", { name: "บันทึกนัดดูห้อง" }));

    await waitFor(() => expect(screen.getByText(/พบการนัดหมายซ้อนของ Agent คนเดียวกัน/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "ยืนยันบันทึกนัดซ้อน" }));

    await waitFor(() => {
      const postCalls = mockApi.mock.calls.filter(
        ([p, init]) => p === "/api/v1/appointments" && (init as RequestInit | undefined)?.method === "POST",
      );
      expect(postCalls).toHaveLength(2);
      const secondBody = JSON.parse(String((postCalls[1]![1] as RequestInit).body));
      expect(secondBody.confirmOverlap).toBe(true);
      expect(secondBody.assetIds).toEqual(["as-1", "as-2"]);
    });
  });
});
