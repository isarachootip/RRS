import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PdpaTab } from "./pdpa-tab";

const apiMock = vi.fn();

vi.mock("@/lib/api", () => ({
  api: (...args: unknown[]) => apiMock(...args),
}));

describe("P24 · PdpaTab (DSR Export, Anonymize & Data Retention 24 เดือน)", () => {
  beforeEach(() => {
    apiMock.mockReset();
  });

  it("แสดงรายการเจ้าของข้อมูล กด Export JSON, กด Anonymize และกดรันตรวจสอบ Data Retention 24 เดือนได้", async () => {
    apiMock.mockImplementation((path: string, opts?: { method?: string }) => {
      if (path.startsWith("/api/v1/pdpa/subjects") && path.includes("/export")) {
        return Promise.resolve({
          exportedAt: "2026-11-06T00:00:00.000Z",
          subjectType: "LEAD",
          subject: { code: "LD-240001", fullName: "คุณสมชาย ทดสอบ" },
        });
      }
      if (path.startsWith("/api/v1/pdpa/subjects") && opts?.method === "POST") {
        return Promise.resolve({ id: "lead-1", fullName: "นิรนาม (PDPA Anonymized)" });
      }
      if (path === "/api/v1/pdpa/jobs/retention-cleanup") {
        return Promise.resolve({ anonymizedCount: 2, retentionMonths: 24 });
      }
      return Promise.resolve({
        items: [
          {
            id: "lead-1",
            subjectType: "LEAD",
            code: "LD-240001",
            fullName: "คุณสมชาย ทดสอบ",
            phone: "+66891234567",
            lineId: "somchai_line",
            email: "somchai@example.com",
            status: "CONTRACTED",
            consentAt: "2026-10-01T10:00:00.000Z",
            lastActivityAt: "2026-10-15T10:00:00.000Z",
            updatedAt: "2026-10-15T10:00:00.000Z",
            isAnonymized: false,
          },
        ],
      });
    });

    render(<PdpaTab />);

    await waitFor(() => {
      expect(screen.getByText("คุณสมชาย ทดสอบ")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Export JSON" }));
    await waitFor(() => {
      expect(screen.getByText(/ส่งออกข้อมูลส่วนบุคคลของ LD-240001/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /ลบข้อมูลระบุตัวตน \(Anonymize\)/ }));
    await waitFor(() => {
      expect(screen.getByText(/ลบข้อมูลระบุตัวตน \(Anonymize\) ของ LD-240001 สำเร็จ/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /รันตรวจสอบ Data Retention \(24 เดือน\)/ }));
    await waitFor(() => {
      expect(screen.getByText(/รันงานล้างข้อมูลตามเกณฑ์ 24 เดือนสำเร็จ/)).toBeInTheDocument();
    });
  });
});
