import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthContextValue } from "@/lib/auth";
import { SettingsView } from "./settings-view";

const mockFetch = vi.fn();

function renderWithRole(role: "ADMIN" | "AGENT") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const auth: AuthContextValue = {
    status: "authenticated",
    user: {
      id: "u-1",
      email: `${role.toLowerCase()}@rrs.local`,
      fullName: role === "ADMIN" ? "แอดมิน หนึ่ง" : "เอเจนต์ เอ",
      teamId: null,
      roles: [role],
      permissions:
        role === "ADMIN" ? { "user.manage": "ALL", "role.manage": "ALL", "team.read": "ALL" } : { "lead.read": "OWN" },
      totpEnabled: true,
      mfaRequired: role === "ADMIN",
    },
    signedIn: vi.fn(),
    logout: vi.fn(),
  };

  return render(
    <QueryClientProvider client={qc}>
      <AuthContext.Provider value={auth}>
        <SettingsView />
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal("fetch", mockFetch);
  mockFetch.mockImplementation(async (input: string, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (url.endsWith("/api/v1/users") && method === "GET") {
      return {
        ok: true,
        json: async () => ({
          items: [
            {
              id: "u-agent-1",
              email: "agent1@rrs.local",
              fullName: "เอเจนต์ เอ",
              nickname: "เอ",
              phone: "+66812345678",
              teamId: "t-1",
              teamName: "ทีมสุขุมวิท",
              isActive: true,
              isFreelance: false,
              totpEnabled: true,
              lastLoginAt: null,
              roles: [{ id: "r-agent", code: "AGENT", name: "เอเจนต์" }],
            },
          ],
        }),
      };
    }
    if (url.endsWith("/api/v1/teams") && method === "GET") {
      return {
        ok: true,
        json: async () => ({
          items: [{ id: "t-1", name: "ทีมสุขุมวิท", managerId: null, managerName: null, memberCount: 1, members: [] }],
        }),
      };
    }
    if (url.endsWith("/api/v1/roles") && method === "GET") {
      return {
        ok: true,
        json: async () => ({
          roles: [
            {
              id: "r-agent",
              code: "AGENT",
              name: "เอเจนต์",
              description: null,
              isSystem: true,
              userCount: 1,
              permissions: [
                { code: "lead.read", scope: "OWN" },
                { code: "lead.write", scope: "OWN" },
              ],
            },
          ],
          catalog: [
            { code: "lead.read", module: "lead", description: "ดูลูกค้า" },
            { code: "lead.write", module: "lead", description: "เพิ่ม/แก้ลูกค้า" },
          ],
        }),
      };
    }
    return { ok: true, json: async () => ({ ok: true }) };
  });
});

describe("SettingsView", () => {
  it("ไม่ใช่ Admin → แสดงหน้าไม่มีสิทธิ์เข้าถึง", () => {
    renderWithRole("AGENT");
    expect(screen.getByRole("heading", { name: "ไม่มีสิทธิ์เข้าถึง" })).toBeInTheDocument();
  });

  it("Admin → แสดงแท็บ ผู้ใช้, ทีม, บทบาทและสิทธิ์ และรีเซ็ต 2FA ได้", async () => {
    const user = userEvent.setup();
    renderWithRole("ADMIN");
    expect(await screen.findByText("agent1@rrs.local")).toBeInTheDocument();

    const resetBtn = screen.getByRole("button", { name: "รีเซ็ต 2FA" });
    await user.click(resetBtn);
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/users/u-agent-1/reset-mfa"),
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("Admin → เปิดแท็บบทบาทและสิทธิ์ ปรับ checkbox/scope แล้วกดบันทึกได้", async () => {
    const user = userEvent.setup();
    renderWithRole("ADMIN");
    await user.click(screen.getByRole("tab", { name: "บทบาทและสิทธิ์" }));

    const checkbox = await screen.findByRole("checkbox", { name: /เพิ่ม\/แก้ลูกค้า/ });
    expect(checkbox).toBeChecked();
    await user.click(checkbox);
    expect(checkbox).not.toBeChecked();

    await user.click(screen.getByRole("button", { name: "บันทึกสิทธิ์" }));
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/roles/r-agent/permissions"),
        expect.objectContaining({ method: "PUT" }),
      );
    });
  });
});
