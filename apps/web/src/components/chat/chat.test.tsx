import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatView } from "./chat-view";

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal("fetch", mockFetch);
  mockFetch.mockImplementation(async (input: string, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";

    if (url.includes("/api/v1/chat/rooms?type=CUSTOMER") && method === "GET") {
      return {
        ok: true,
        json: async () => ({
          items: [
            {
              id: "room-cust-1",
              type: "CUSTOMER",
              publicToken: "tok-cust-1",
              title: "ลูกค้าสมชาย (0812345678)",
              subtitle: "สนใจทรัพย์ PR-000031",
              lineUserId: "U123456",
              leadId: null,
              ownerId: null,
              assetCode: "PR-000031",
              assignedAgentId: null,
              unreadCount: 2,
              lastMessageAt: new Date().toISOString(),
              lastMessagePreview: "ขอนัดดูคอนโดเสาร์นี้ครับ",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
          unreadSummary: { customerUnread: 2, ownerUnread: 1, totalUnread: 3 },
        }),
      };
    }

    if (url.includes("/api/v1/chat/rooms?type=OWNER") && method === "GET") {
      return {
        ok: true,
        json: async () => ({
          items: [
            {
              id: "room-owner-1",
              type: "OWNER",
              publicToken: "tok-owner-1",
              title: "คุณสมศรี เจ้าของทรัพย์",
              subtitle: "OW-000001 · +66899998888",
              lineUserId: null,
              leadId: null,
              ownerId: "owner-1",
              assetCode: "PR-000031",
              assignedAgentId: null,
              unreadCount: 1,
              lastMessageAt: new Date().toISOString(),
              lastMessagePreview: "ลดราคาเช่าได้เหลือ 14,000 บาทค่ะ",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
          unreadSummary: { customerUnread: 2, ownerUnread: 1, totalUnread: 3 },
        }),
      };
    }

    if (url.includes("/api/v1/owners") && method === "GET") {
      return {
        ok: true,
        json: async () => ({
          items: [{ id: "owner-1", code: "OW-000001", fullName: "คุณสมศรี เจ้าของทรัพย์", phone: "+66899998888", lineId: null }],
        }),
      };
    }

    if (url.endsWith("/api/v1/chat/rooms/room-cust-1") || url.endsWith("/api/v1/chat/rooms/room-owner-1")) {
      return {
        ok: true,
        json: async () => ({
          id: "room-cust-1",
          type: "CUSTOMER",
          publicToken: "tok-cust-1",
          title: "ลูกค้าสมชาย (0812345678)",
          subtitle: "สนใจทรัพย์ PR-000031",
          lineUserId: "U123456",
          assetCode: "PR-000031",
          messages: [
            {
              id: "m-1",
              roomId: "room-cust-1",
              senderType: "CUSTOMER",
              senderUserId: null,
              senderName: "ลูกค้าสมชาย",
              content: "ขอนัดดูคอนโดเสาร์นี้ครับ",
              imageUrl: null,
              assetCode: "PR-000031",
              createdAt: new Date().toISOString(),
            },
          ],
        }),
      };
    }

    return { ok: true, json: async () => ({ ok: true }) };
  });
});

describe("ChatView (Customer & Owner Internal Chat)", () => {
  it("แสดงแท็บ ลูกค้าทักเข้ามา และ คุยกับเจ้าของทรัพย์สิน พร้อมส่งข้อความตอบกลับได้", async () => {
    const user = userEvent.setup();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <ChatView />
      </QueryClientProvider>,
    );

    expect(await screen.findAllByText("ลูกค้าสมชาย (0812345678)")).toBeTruthy();
    expect(await screen.findAllByText("ขอนัดดูคอนโดเสาร์นี้ครับ")).toBeTruthy();

    const input = await screen.findByPlaceholderText(/พิมพ์ข้อความตอบกลับ/);
    await user.type(input, "ยินดีครับ นัดชมได้เวลา 10:00 น. ครับ");
    await user.click(screen.getByRole("button", { name: "ส่งข้อความ" }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/chat/rooms/room-cust-1/messages"),
        expect.objectContaining({ method: "POST" }),
      );
    });

    await user.click(screen.getByRole("tab", { name: /2\. คุยกับเจ้าของทรัพย์สิน/ }));
    expect(await screen.findByText("คุณสมศรี เจ้าของทรัพย์")).toBeInTheDocument();
  });
});
