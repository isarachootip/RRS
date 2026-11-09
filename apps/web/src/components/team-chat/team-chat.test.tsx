import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TeamChatView } from "./team-chat-view";

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    user: {
      id: "user-admin",
      email: "admin@rrs.local",
      fullName: "แอดมิน ระบบ",
      teamId: null,
      roles: ["ADMIN"],
      permissions: {},
    },
  }),
}));

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal("fetch", mockFetch);
  Element.prototype.scrollIntoView = vi.fn();

  mockFetch.mockImplementation(async (input: string, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";

    if (url.includes("/api/v1/team-chat/channels") && !url.includes("/messages") && method === "GET") {
      return {
        ok: true,
        json: async () => ({
          channels: [
            {
              id: "ch-general",
              name: "ทั่วไป (General)",
              description: "ห้องสนทนารวมทั้งบริษัท",
              isGeneral: true,
              teamId: null,
              memberIds: ["user-admin", "user-agent-1", "user-agent-2"],
              memberCount: 3,
              unreadCount: 0,
              updatedAt: new Date().toISOString(),
            },
            {
              id: "ch-rent",
              name: "ทีมเช่า",
              description: "ห้องแชทประจำทีมเช่า",
              isGeneral: false,
              teamId: "team-rent",
              memberIds: ["user-admin", "user-agent-1"],
              memberCount: 2,
              unreadCount: 2,
              updatedAt: new Date().toISOString(),
            },
          ],
          users: [
            { id: "user-admin", fullName: "แอดมิน ระบบ", nickname: "Admin", email: "admin@rrs.local", teamId: null },
            { id: "user-agent-1", fullName: "สมชาย สายเช่า", nickname: "ชาย", email: "agent1@rrs.local", teamId: "team-rent" },
            { id: "user-agent-2", fullName: "สมหญิง สายขาย", nickname: "หญิง", email: "agent2@rrs.local", teamId: "team-sale" },
          ],
          totalUnread: 2,
        }),
      };
    }

    if (url.includes("/api/v1/team-chat/channels/") && url.endsWith("/messages") && method === "GET") {
      return {
        ok: true,
        json: async () => ({
          items: [
            {
              id: "tm-1",
              channelId: "ch-general",
              senderId: "user-agent-1",
              senderName: "สมชาย สายเช่า",
              content: "สวัสดีครับ @แอดมิน ระบบ ฝากตรวจห้องใหม่ด้วยครับ",
              attachments: [],
              mentionedUserIds: ["user-admin"],
              createdAt: new Date("2026-11-09T03:39:00Z").toISOString(),
            },
          ],
        }),
      };
    }

    if (url.includes("/api/v1/team-chat/channels/") && url.endsWith("/messages") && method === "POST") {
      const body = JSON.parse(String(init?.body ?? "{}"));
      return {
        ok: true,
        json: async () => ({
          id: "tm-2",
          channelId: "ch-general",
          senderId: "user-admin",
          senderName: "แอดมิน ระบบ",
          content: body.content,
          attachments: body.attachments ?? [],
          mentionedUserIds: body.mentionedUserIds ?? [],
          createdAt: new Date().toISOString(),
        }),
      };
    }

    if (url.endsWith("/api/v1/team-chat/channels") && method === "POST") {
      const body = JSON.parse(String(init?.body ?? "{}"));
      return {
        ok: true,
        json: async () => ({
          id: "ch-new",
          name: body.name,
          description: body.description ?? null,
          isGeneral: false,
          teamId: null,
        }),
      };
    }

    return { ok: true, json: async () => ({ ok: true }) };
  });
});

describe("TeamChatView (Internal Team Chat แบบ NexTime ProjectChat)", () => {
  it("แสดงรายการ #Channel ทางซ้าย ข้อความไฮไลต์ @mention และรองรับพิมพ์ @ เพื่อเลือกผู้รับพร้อมส่งข้อความ", async () => {
    const user = userEvent.setup();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <TeamChatView />
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Team Chat")).toBeInTheDocument();
    expect(await screen.findAllByText("ทั่วไป (General)")).toBeTruthy();
    expect(await screen.findByText("ทีมเช่า")).toBeInTheDocument();
    expect(await screen.findByText("3 members")).toBeInTheDocument();
    expect(await screen.findByText("@แอดมิน ระบบ")).toBeInTheDocument();

    const input = await screen.findByPlaceholderText("Message #ทั่วไป (General)...");
    await user.type(input, "รับทราบครับ @สมชาย");

    const mentionOption = await screen.findByTestId("mention-option-user-agent-1");
    await user.click(mentionOption);

    expect((input as HTMLInputElement).value).toContain("@สมชาย สายเช่า ");

    await user.click(screen.getByRole("button", { name: "ส่งข้อความ" }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/team-chat/channels/ch-general/messages"),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("user-agent-1"),
        }),
      );
    });
  });

  it("สามารถเปิด Modal สร้างห้อง #Channel ใหม่พร้อมเลือกสมาชิกได้", async () => {
    const user = userEvent.setup();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <TeamChatView />
      </QueryClientProvider>,
    );

    await user.click(await screen.findByRole("button", { name: "+ สร้างห้อง" }));
    const nameInput = await screen.findByPlaceholderText("เช่น ดีลคอนโดสุขุมวิท, ทีมการตลาด...");
    await user.type(nameInput, "ดีลคอนโดสุขุมวิท");
    await user.click(screen.getByRole("button", { name: "สร้างห้องแชท" }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/team-chat/channels"),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("ดีลคอนโดสุขุมวิท"),
        }),
      );
    });
  });
});
