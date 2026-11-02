import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LeadMatchingPanel } from "./lead-matching-panel";
import * as apiModule from "@/lib/api";

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: vi.fn(),
  };
});

describe("P09 · LeadMatchingPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("แสดงห้องว่างเรียงตามคะแนนความตรงเงื่อนไข เลือก 3 ห้อง และสร้างลิงก์แชร์ 7 วันได้", async () => {
    const apiMock = vi.mocked(apiModule.api);
    apiMock.mockImplementation(async (path: string, init?: RequestInit) => {
      if (init?.method === "POST" && path.endsWith("/offers")) {
        return { shareToken: "tok-7days-abc123" };
      }
      return {
        criteria: {
          intent: "RENT",
          location: "สุขุมวิท",
          budgetMin: 20000,
          budgetMax: 30000,
          category: "CONDO",
          minAreaSqm: 30,
          petRequired: true,
        },
        items: [
          {
            id: "a1",
            code: "PR-000101",
            category: "CONDO",
            unitNo: "32/99",
            rentPrice: "25000.00",
            salePrice: null,
            areaSqm: 35,
            petAllowed: true,
            matchScore: 90,
            matchedReasons: ["ประเภททรัพย์ตรง", "อยู่ในงบประมาณ", "ทำเลตรง"],
            hasViewingScheduled: false,
            project: { id: "p1", name: "แอชตัน อโศก-สุขุมวิท", district: "วัฒนา" },
            primaryAgent: { id: "u1", fullName: "Agent A" },
          },
          {
            id: "a2",
            code: "PR-000102",
            category: "CONDO",
            unitNo: "12/05",
            rentPrice: "22000.00",
            salePrice: null,
            areaSqm: 28,
            petAllowed: true,
            matchScore: 70,
            matchedReasons: ["ประเภททรัพย์ตรง", "อยู่ในงบประมาณ"],
            hasViewingScheduled: true,
            project: { id: "p1", name: "แอชตัน อโศก-สุขุมวิท", district: "วัฒนา" },
            primaryAgent: { id: "u1", fullName: "Agent A" },
          },
          {
            id: "a3",
            code: "PR-000103",
            category: "CONDO",
            unitNo: "18/10",
            rentPrice: "29000.00",
            salePrice: null,
            areaSqm: 36,
            petAllowed: true,
            matchScore: 60,
            matchedReasons: ["ประเภททรัพย์ตรง", "อยู่ในงบประมาณ"],
            hasViewingScheduled: false,
            project: { id: "p1", name: "แอชตัน อโศก-สุขุมวิท", district: "วัฒนา" },
            primaryAgent: { id: "u1", fullName: "Agent A" },
          },
        ],
      };
    });

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <LeadMatchingPanel leadId="lead-1" />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("PR-000101")).toBeInTheDocument();
    });
    expect(screen.getByText("90 คะแนน")).toBeInTheDocument();
    expect(screen.getByText("มีนัดดู")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("เลือกห้อง PR-000101"));
    fireEvent.click(screen.getByLabelText("เลือกห้อง PR-000102"));
    fireEvent.click(screen.getByLabelText("เลือกห้อง PR-000103"));

    fireEvent.click(screen.getByRole("button", { name: "บันทึกเป็นห้องที่เสนอ & สร้างลิงก์แชร์ (3)" }));

    await waitFor(() => {
      expect(screen.getByText("/share/tok-7days-abc123")).toBeInTheDocument();
    });
  });
});
