import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OwnerFormModal } from "../owners/owner-form-modal";
import { AssetFormModal } from "./asset-form-modal";
import { parseGoogleMapsCoords } from "./asset-location-media-fields";
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
        json: async () => ({ items: [{ id: "ow-1", code: "OW-000001", fullName: "สมศักดิ์ เดิม", agentName: "เอเจนต์ เอ" }] }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "ow-2", code: "OW-000002" }) });

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
  it("เปลี่ยนฟิลด์เฉพาะตามประเภทสินทรัพย์ (CONDO → HOUSE → COMMERCIAL → LAND → FACTORY) และสร้างอพาร์ตเมนต์ 10 ห้องได้", async () => {
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
    expect(screen.getByLabelText("อาคารหรือตึก")).toBeInTheDocument();
    expect(screen.getByLabelText("ชั้น")).toBeInTheDocument();
    expect(screen.getByLabelText("รูปแบบห้อง")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("ประเภทสินทรัพย์"), "HOUSE");
    expect(screen.getByLabelText("ที่ดิน (ไร่)")).toBeInTheDocument();
    expect(screen.queryByLabelText("อาคารหรือตึก")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("ชั้น")).not.toBeInTheDocument();
    expect(screen.getByLabelText("จำนวนห้องนอน")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("ประเภทสินทรัพย์"), "COMMERCIAL");
    expect(screen.getByLabelText("จำนวนคูหา")).toBeInTheDocument();
    expect(screen.getByLabelText("มีชั้นลอย")).toBeInTheDocument();
    expect(screen.getByLabelText("หน้ากว้างอาคาร (เมตร)")).toBeInTheDocument();
    expect(screen.getByLabelText("ความลึกอาคาร (เมตร)")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("ประเภทสินทรัพย์"), "LAND");
    expect(screen.getByLabelText("ประเภทเอกสารสิทธิ์")).toBeInTheDocument();
    expect(screen.queryByLabelText("พื้นที่ใช้สอย")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("จำนวนห้องนอน")).not.toBeInTheDocument();

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

  it("AssetFormModal รองรับการแก้ไขทรัพย์สินเดิมผ่าน PATCH /api/v1/assets/:id", async () => {
    const user = userEvent.setup();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const onSaved = vi.fn();

    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      if (String(input).includes("/api/v1/owners")) {
        return { ok: true, json: async () => ({ items: [{ id: "ow-1", code: "OW-000001", fullName: "เจ้าของ A" }] }) };
      }
      return { ok: true, json: async () => ({ id: "asset-1" }) };
    });

    render(
      <QueryClientProvider client={qc}>
        <AssetFormModal
          initial={{ id: "asset-1", code: "PR-000001", category: "CONDO", ownershipType: "OWNER", unitNo: "1205", rentPrice: "18000", minRentPrice: "16000" }}
          onClose={vi.fn()}
          onSaved={onSaved}
        />
      </QueryClientProvider>,
    );

    const rentInput = screen.getByLabelText("ราคาเช่าต่อเดือน");
    await user.clear(rentInput);
    await user.type(rentInput, "20000");
    await user.click(screen.getByRole("button", { name: "บันทึกทรัพย์สิน" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("/api/v1/assets/asset-1"), expect.objectContaining({ method: "PATCH" }));
  });

  it("parseGoogleMapsCoords แยกพิกัด Latitude/Longitude จากลิงก์ Google Maps ได้ถูกต้อง", () => {
    expect(parseGoogleMapsCoords("https://www.google.com/maps/place/Bangkok/@13.7563,100.5018,17z")).toEqual({ lat: "13.7563", lng: "100.5018" });
    expect(parseGoogleMapsCoords("https://maps.google.com/?q=13.7307,100.5691")).toEqual({ lat: "13.7307", lng: "100.5691" });
    expect(parseGoogleMapsCoords("13.7450, 100.5340")).toEqual({ lat: "13.745", lng: "100.534" });
  });

  it("GoogleLocationPicker ค้นหาชื่อสถานที่และเลือกเติมพิกัด + เขต + จังหวัด อัตโนมัติพร้อมแสดงแผนที่ Google Maps", async () => {
    const user = userEvent.setup();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      if (String(input).includes("nominatim.openstreetmap.org/search")) {
        return {
          ok: true,
          json: async () => [
            { display_name: "เซ็นทรัล ลาดพร้าว, ถนนพหลโยธิน, จตุจักร, กรุงเทพมหานคร", lat: "13.816111", lon: "100.561222", address: { city_district: "เขตจตุจักร", state: "กรุงเทพมหานคร" } },
          ],
        };
      }
      return { ok: true, json: async () => ({ items: [] }) };
    });

    render(
      <QueryClientProvider client={qc}>
        <AssetFormModal onClose={vi.fn()} onSaved={vi.fn()} />
      </QueryClientProvider>,
    );

    expect(screen.getByTitle("Google Maps Location Preview")).toBeInTheDocument();
    await user.type(screen.getByLabelText("วางลิงก์ Google Maps"), "เซ็นทรัล ลาดพร้าว");
    await user.click(screen.getByRole("button", { name: "🔍 ค้นหาสถานที่" }));

    const resultBtn = await screen.findByRole("button", { name: /เซ็นทรัล ลาดพร้าว/ });
    await user.click(resultBtn);

    expect((screen.getByLabelText("ละติจูด") as HTMLInputElement).value).toBe("13.816111");
    expect((screen.getByLabelText("ลองจิจูด") as HTMLInputElement).value).toBe("100.561222");
    expect((screen.getByLabelText("เขตหรืออำเภอ") as HTMLInputElement).value).toBe("จตุจักร");
    expect((screen.getByLabelText("จังหวัด") as HTMLInputElement).value).toBe("กรุงเทพมหานคร");
  });
});
