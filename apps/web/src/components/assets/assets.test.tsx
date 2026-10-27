import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OwnerFormModal } from "../owners/owner-form-modal";
import { AssetFormModal } from "./asset-form-modal";
import { BulkApartmentModal } from "./bulk-apartment-modal";

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal("fetch", mockFetch);
});

describe("P06 · OwnerFormModal (แจ้งเตือนข้อมูลซ้ำ แต่ไม่บล็อก)", () => {
  it("ตรวจพบเบอร์ซ้ำ → แสดงคำเตือน และเมื่อกดยืนยันบันทึกซ้ำจึงส่ง POST /api/v1/owners", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [{ id: "ow-1", code: "OW-000001", fullName: "สมศักดิ์ เดิม", agentName: "เอเจนต์ เอ" }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "ow-2", code: "OW-000002" }),
      });

    render(<OwnerFormModal onClose={vi.fn()} onSaved={onSaved} />);

    await user.type(screen.getByLabelText("ชื่อ-นามสกุลเจ้าของทรัพย์"), "สมศักดิ์ ใหม่");
    await user.type(screen.getByLabelText("เบอร์โทรศัพท์เจ้าของทรัพย์"), "0812345678");
    await user.click(screen.getByRole("button", { name: "บันทึกเจ้าของทรัพย์" }));

    expect(await screen.findByText(/พบเจ้าของทรัพย์ที่มีเบอร์โทร/)).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "ยืนยันบันทึกซ้ำ" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  });
});

describe("P06 · AssetFormModal และ BulkApartmentModal", () => {
  it("เปลี่ยนฟิลด์เฉพาะตามประเภทสินทรัพย์ (CONDO → HOUSE → FACTORY) และสร้างอพาร์ตเมนต์ 10 ห้องได้", async () => {
    const user = userEvent.setup();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/v1/owners")) {
        return { ok: true, json: async () => ({ items: [{ id: "ow-1", code: "OW-000001", fullName: "เจ้าของ A" }] }) };
      }
      if (url.includes("/api/v1/buildings") && !url.includes("/bulk-units")) {
        return { ok: true, json: async () => ({ id: "bld-1" }) };
      }
      return { ok: true, json: async () => ({ createdCount: 10, items: [] }) };
    });

    const { unmount } = render(
      <QueryClientProvider client={qc}>
        <AssetFormModal onClose={vi.fn()} onSaved={vi.fn()} />
      </QueryClientProvider>,
    );

    expect(screen.getByLabelText("ค่าส่วนกลางต่อตารางเมตร")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("ประเภทสินทรัพย์"), "HOUSE");
    expect(screen.getByLabelText("ที่ดิน (ไร่)")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("ประเภทสินทรัพย์"), "FACTORY");
    expect(screen.getByLabelText("พื้นที่อาคารโรงงาน")).toBeInTheDocument();
    unmount();

    const onBulkSaved = vi.fn();
    render(
      <QueryClientProvider client={qc}>
        <BulkApartmentModal onClose={vi.fn()} onSaved={onBulkSaved} />
      </QueryClientProvider>,
    );

    await user.type(screen.getByLabelText("ชื่ออาคารอพาร์ตเมนต์"), "หอพักสุขใจ");
    await waitFor(() => expect(screen.getByRole("option", { name: /OW-000001/ })).toBeInTheDocument());
    await user.selectOptions(screen.getByLabelText("เจ้าของอาคารอพาร์ตเมนต์"), "ow-1");
    await user.click(screen.getByRole("button", { name: "สร้างอาคารและห้องทั้งหมด" }));

    await waitFor(() => expect(onBulkSaved).toHaveBeenCalledTimes(1));
  });
});
