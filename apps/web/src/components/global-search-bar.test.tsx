import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GlobalSearchBar } from "./global-search-bar";
import * as apiModule from "@/lib/api";

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: vi.fn(),
  };
});

describe("P08 · GlobalSearchBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ค้นหาชื่อโครงการ/เบอร์โทร และแสดงผลแยกหมวด ทรัพย์สิน ลูกค้า และเจ้าของทรัพย์", async () => {
    vi.mocked(apiModule.api).mockResolvedValue({
      owners: [{ id: "o-1", code: "OW-000001", fullName: "คุณเกรียงไกร ทองหล่อ", phone: "08x-xxx-9999" }],
      assets: [
        {
          id: "a-1",
          code: "PR-000001",
          unitNo: "24/88",
          project: { name: "ไอดีโอ คิว สุขุมวิท 36" },
        },
      ],
      leads: [{ id: "l-1", code: "LD-000001", fullName: "คุณพิมพ์ชนก อโศก", phone: "08x-xxx-6655" }],
      tookMs: 12,
    });

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <GlobalSearchBar />
      </QueryClientProvider>,
    );

    const searchInput = screen.getByPlaceholderText("ค้นหาชื่อ เบอร์โทร โครงการ หรือเลขห้อง");
    fireEvent.focus(searchInput);
    fireEvent.change(searchInput, { target: { value: "สุขุมวิท" } });

    await waitFor(() => {
      expect(screen.getByText("PR-000001")).toBeInTheDocument();
    });
    expect(screen.getByText("LD-000001")).toBeInTheDocument();
    expect(screen.getByText("OW-000001")).toBeInTheDocument();
  });
});
