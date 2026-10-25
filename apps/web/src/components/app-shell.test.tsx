import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthContextValue } from "@/lib/auth";
import { AppShell } from "./app-shell";
import { isActive } from "./nav";

let pathname = "/leads";
const logout = vi.fn().mockResolvedValue(undefined);
const auth: AuthContextValue = {
  status: "authenticated",
  user: {
    id: "u1",
    email: "agent1@rrs.local",
    fullName: "เอเจนต์ เอ",
    teamId: null,
    roles: ["AGENT"],
    permissions: {},
    totpEnabled: false,
    mfaRequired: false,
  },
  signedIn: vi.fn(),
  logout,
};
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

function renderShell() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AuthContext.Provider value={auth}>
        <AppShell>
          <p>เนื้อหา</p>
        </AppShell>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  pathname = "/leads";
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: "ok" }) }));
});

describe("AppShell", () => {
  it("แสดงเมนูภาษาไทยครบ และไฮไลต์หน้าปัจจุบัน", () => {
    renderShell();
    const nav = within(screen.getByTestId("sidebar-desktop")).getByRole("navigation", { name: "เมนูหลัก" });
    for (const label of ["ภาพรวม", "ลูกค้า", "ทรัพย์สิน", "นัดดูห้อง", "จองและสัญญา", "ค่านายหน้า", "รายงาน"]) {
      expect(within(nav).getByRole("link", { name: label })).toBeInTheDocument();
    }
    expect(within(nav).getByRole("link", { name: "ลูกค้า" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "ภาพรวม" })).not.toHaveAttribute("aria-current");
    expect(within(nav).queryByRole("link", { name: "ตั้งค่า" })).not.toBeInTheDocument();
  });

  it("ซ่อนเมนูที่ผู้ใช้ไม่มีสิทธิ์ตาม permissions จาก /auth/me", () => {
    const prevUser = auth.user;
    auth.user = {
      ...prevUser!,
      roles: ["ACCOUNTING"],
      permissions: { "dashboard.read": "ALL", "commissions.read": "ALL" } as Record<string, "ALL" | "TEAM" | "OWN">,
    };
    renderShell();
    const nav = within(screen.getByTestId("sidebar-desktop")).getByRole("navigation", { name: "เมนูหลัก" });
    expect(within(nav).getByRole("link", { name: "ภาพรวม" })).toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: "ลูกค้า" })).not.toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: "ตั้งค่า" })).not.toBeInTheDocument();
    auth.user = prevUser;
  });

  it("ปุ่มเมนูบนมือถือเปิด/ปิด drawer และปิดด้วย Escape", async () => {
    const user = userEvent.setup();
    renderShell();
    expect(screen.queryByTestId("sidebar-drawer")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "เปิดเมนู" }));
    expect(screen.getByTestId("sidebar-drawer")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByTestId("sidebar-drawer")).not.toBeInTheDocument();
  });

  it("เมนูผู้ใช้แสดงชื่อและออกจากระบบได้", async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(screen.getByRole("button", { name: "บัญชีของฉัน" }));
    expect(screen.getByText("agent1@rrs.local")).toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "ออกจากระบบ" }));
    expect(logout).toHaveBeenCalled();
  });

  it("แสดงสถานะ API", async () => {
    renderShell();
    expect(await screen.findByText("เชื่อมต่อระบบแล้ว")).toBeInTheDocument();
  });

  it("API ล่ม → บอกวิธีแก้", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    renderShell();
    expect(await screen.findByText(/เชื่อมต่อระบบไม่ได้/)).toBeInTheDocument();
  });
});

describe("isActive", () => {
  it.each([
    ["/", "/", true],
    ["/leads", "/", false],
    ["/leads/123", "/leads", true],
    ["/leadsx", "/leads", false],
  ])("%s กับ %s → %s", (path, href, expected) => {
    expect(isActive(path, href)).toBe(expected);
  });
});
