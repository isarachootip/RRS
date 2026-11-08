import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ListingsView } from "./listings-view";

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    user: { id: "u-1", roles: ["ADMIN"], permissions: { "listing.approve": true } },
  }),
}));

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal("fetch", mockFetch);
});

describe("ListingsView · สร้างประกาศเว็บอัตโนมัติตามประเภททรัพย์สิน", () => {
  it("เลือกคอนโด vs อาคารพาณิชย์/ห้องแถว แล้วเติมหัวข้อ คำบรรยาย และราคาตามประเภทอัตโนมัติ", async () => {
    const user = userEvent.setup();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/v1/assets")) {
        return {
          ok: true,
          json: async () => ({
            items: [
              {
                id: "asset-condo",
                code: "PR-000013",
                category: "CONDO",
                areaSqm: 58,
                floor: 31,
                bedrooms: 2,
                bathrooms: 2,
                rentPrice: 21000,
                salePrice: 33180000,
                project: { name: "เดอะ ริเวอร์ไซด์" },
                attributes: { facing: "ทิศเหนือ", parkingSlots: 1 },
              },
              {
                id: "asset-comm",
                code: "PR-000020",
                category: "COMMERCIAL",
                areaSqm: 240,
                district: "สาทร",
                rentPrice: 55000,
                salePrice: 18500000,
                attributes: { bays: 2, stories: 4, hasMezzanine: true, frontageM: 8, depthM: 12 },
              },
            ],
          }),
        };
      }
      return { ok: true, json: async () => ({ total: 0, items: [] }) };
    });

    render(
      <QueryClientProvider client={qc}>
        <ListingsView />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(screen.getByRole("option", { name: /PR-000013/ })).toBeInTheDocument());

    await user.selectOptions(screen.getByLabelText("เลือกทรัพย์สิน"), "asset-condo");
    expect((screen.getByLabelText("ราคาประกาศ") as HTMLInputElement).value).toBe("21000");
    expect((screen.getByLabelText("หัวข้อภาษาไทย") as HTMLInputElement).value).toContain("ให้เช่าคอนโด");
    expect((screen.getByLabelText("หัวข้อภาษาไทย") as HTMLInputElement).value).toContain("ชั้น 31");

    await user.selectOptions(screen.getByLabelText("เลือกทรัพย์สิน"), "asset-comm");
    expect((screen.getByLabelText("ราคาประกาศ") as HTMLInputElement).value).toBe("55000");
    expect((screen.getByLabelText("หัวข้อภาษาไทย") as HTMLInputElement).value).toContain("อาคารพาณิชย์/ห้องแถว");
    expect((screen.getByLabelText("หัวข้อภาษาไทย") as HTMLInputElement).value).toContain("2 คูหา");

    await user.selectOptions(screen.getByLabelText("ประเภทประกาศ"), "SALE");
    expect((screen.getByLabelText("ราคาประกาศ") as HTMLInputElement).value).toBe("18500000");
    expect((screen.getByLabelText("หัวข้อภาษาไทย") as HTMLInputElement).value).toContain("ขายอาคารพาณิชย์/ห้องแถว");
  });
});
