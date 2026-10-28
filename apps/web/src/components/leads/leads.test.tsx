import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LeadDetailPanels } from "./lead-detail-panels";
import { LeadFormModal } from "./lead-form-modal";
import { LeadsKanban, type LeadItem } from "./leads-kanban";
import * as apiModule from "@/lib/api";

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: vi.fn(),
  };
});

describe("P07 Lead Components", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("LeadFormModal detects duplicate lead, shows ownerAgentName and sends collaboration request", async () => {
    const apiMock = vi.mocked(apiModule.api);
    apiMock.mockImplementation(async (path: string) => {
      if (path.startsWith("/api/v1/leads/duplicates")) {
        return {
          duplicates: [
            {
              id: "lead-dup-1",
              code: "LD-000001",
              abbreviatedName: "คุณสมชาย ใจ...",
              ownerAgentId: "agent-a",
              ownerAgentName: "Agent A",
              status: "NEW",
            },
          ],
        };
      }
      return { ok: true };
    });

    const onClose = vi.fn();
    const onSaved = vi.fn();
    render(<LeadFormModal open={true} onClose={onClose} onSaved={onSaved} />);

    fireEvent.change(screen.getByLabelText("ชื่อ-นามสกุล"), {
      target: { value: "คุณสมชาย ใจดี" },
    });
    fireEvent.change(screen.getByLabelText("เบอร์โทรศัพท์"), {
      target: { value: "0812345678" },
    });

    fireEvent.click(screen.getByRole("button", { name: "บันทึก" }));

    await waitFor(() => {
      expect(screen.getByText("พบข้อมูลลูกค้าซ้ำในระบบ")).toBeInTheDocument();
    });
    expect(screen.getByText("Agent A")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "ขอร่วมงาน" }));

    await waitFor(() => {
      expect(screen.getByText("ส่งคำขอร่วมงานแล้ว")).toBeInTheDocument();
    });
    expect(apiMock).toHaveBeenCalledWith(
      "/api/v1/leads/lead-dup-1/collaborators",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("LeadsKanban prompts for reason when changing status to LOST", async () => {
    const apiMock = vi.mocked(apiModule.api).mockResolvedValue({ ok: true });
    const onChanged = vi.fn();
    const items: LeadItem[] = [
      {
        id: "lead-1",
        code: "LD-000002",
        intent: "RENT",
        fullName: "คุณวิภา ทดสอบ",
        phone: "0891112222",
        status: "CONTACTED",
        budgetMin: 15000,
        budgetMax: 20000,
        preferredLocation: "อโศก",
        ownerAgentId: "agent-a",
        ownerAgent: { id: "agent-a", fullName: "Agent A" },
      },
    ];

    render(<LeadsKanban items={items} onChanged={onChanged} />);

    fireEvent.change(screen.getByLabelText("เปลี่ยนสถานะ คุณวิภา ทดสอบ"), {
      target: { value: "LOST" },
    });

    const reasonInput = await screen.findByLabelText("เหตุผลการเปลี่ยนสถานะ");
    fireEvent.change(reasonInput, { target: { value: "ลูกค้าได้ห้องอื่นแล้ว" } });
    fireEvent.click(screen.getByRole("button", { name: "ยืนยันเปลี่ยนสถานะ" }));

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith(
        "/api/v1/leads/lead-1/status",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ status: "LOST", reason: "ลูกค้าได้ห้องอื่นแล้ว" }),
        }),
      );
    });
  });

  it("LeadDetailPanels logs activity and transfers lead with reason", async () => {
    const apiMock = vi.mocked(apiModule.api).mockResolvedValue({ ok: true });
    const onRefresh = vi.fn();

    render(
      <LeadDetailPanels leadId="lead-1" activities={[]} assignments={[]} collaborators={[]} onRefresh={onRefresh} />,
    );

    fireEvent.change(screen.getByLabelText("รายละเอียดการติดต่อ"), {
      target: { value: "โทรคุยเรื่องนัดชมห้อง" },
    });
    fireEvent.click(screen.getByRole("button", { name: "บันทึกการติดต่อ" }));

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith(
        "/api/v1/leads/lead-1/activities",
        expect.objectContaining({ method: "POST" }),
      );
    });

    fireEvent.change(screen.getByLabelText("รหัสผู้ดูแลใหม่"), {
      target: { value: "agent-b-uuid" },
    });
    fireEvent.change(screen.getByLabelText("เหตุผลการโอนผู้ดูแล"), {
      target: { value: "แบ่งเบาภาระทีม" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ยืนยันโอนผู้ดูแล" }));

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith(
        "/api/v1/leads/lead-1/transfer",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ toUserId: "agent-b-uuid", reason: "แบ่งเบาภาระทีม" }),
        }),
      );
    });
  });
});
