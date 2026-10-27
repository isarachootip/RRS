import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConfirmArchiveDialog } from "./confirm-archive-dialog";
import { Timeline } from "./timeline";

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal("fetch", mockFetch);
});

describe("Timeline", () => {
  it("แสดงรายการประวัติและค่าก่อน/หลัง (before → after)", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            id: "101",
            action: "UPDATE",
            actorId: "u-1",
            actorName: "เอเจนต์ เอ",
            createdAt: "2026-10-26T07:00:00.000Z",
            before: { internalNote: "หมายเหตุเดิม", rentPrice: "20000.00" },
            after: { internalNote: "หมายเหตุใหม่", rentPrice: "20000.00" },
          },
        ],
      }),
    });

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <Timeline entityType="asset" entityId="asset-1" />
      </QueryClientProvider>,
    );

    expect(await screen.findByText("เอเจนต์ เอ")).toBeInTheDocument();
    expect(screen.getByText("หมายเหตุเดิม")).toBeInTheDocument();
    expect(screen.getByText("หมายเหตุใหม่")).toBeInTheDocument();
  });
});

describe("ConfirmArchiveDialog", () => {
  it("บังคับยืนยัน 2 ขั้นตอน (กดดำเนินการต่อ แล้วพิมพ์ ARCHIVE) ก่อนเรียก onConfirm", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockResolvedValue(undefined);

    render(<ConfirmArchiveDialog itemLabel="PR-000501" onConfirm={onConfirm} />);

    await user.click(screen.getByRole("button", { name: /เก็บเข้ากรุ/ }));
    expect(screen.getByText(/ขั้นที่ 1\/2/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "ดำเนินการต่อ" }));
    expect(screen.getByText(/ขั้นที่ 2\/2/)).toBeInTheDocument();

    const confirmBtn = screen.getByRole("button", { name: "ยืนยันเก็บเข้ากรุ" });
    expect(confirmBtn).toBeDisabled();

    await user.type(screen.getByPlaceholderText("ARCHIVE"), "ARCHIVE");
    expect(confirmBtn).not.toBeDisabled();

    await user.click(confirmBtn);
    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });
  });
});
