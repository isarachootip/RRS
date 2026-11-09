import { ForbiddenException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUser } from "../src/auth/auth.types";
import { TeamChatService } from "../src/chat/team-chat.service";

function makeUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "user-agent-1",
    email: "agent1@rrs.local",
    teamId: "team-rent",
    roles: ["AGENT"],
    permissions: {},
    ...overrides,
  };
}

describe("TeamChatService (Internal Team Chat แบบ NexTime ProjectChat)", () => {
  const mockPrisma = {
    team: {
      findMany: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    teamChatChannel: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    teamChatMember: {
      upsert: vi.fn(),
      createMany: vi.fn(),
    },
    teamChatMessage: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
  };

  let service: TeamChatService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TeamChatService(mockPrisma as never);

    mockPrisma.team.findMany.mockResolvedValue([
      { id: "team-rent", name: "ทีมเช่า", managerId: "user-mgr-1" },
      { id: "team-sale", name: "ทีมขาย", managerId: "user-mgr-2" },
    ]);

    mockPrisma.user.findMany.mockResolvedValue([
      { id: "user-admin", fullName: "แอดมิน", nickname: "Admin", email: "admin@rrs.local", teamId: null },
      { id: "user-agent-1", fullName: "สมชาย สายเช่า", nickname: "ชาย", email: "agent1@rrs.local", teamId: "team-rent" },
      { id: "user-agent-2", fullName: "สมหญิง สายขาย", nickname: "หญิง", email: "agent2@rrs.local", teamId: "team-sale" },
    ]);
  });

  it("กรองห้องแชทตามสิทธิ์: พนักงานทั่วไปเห็นเฉพาะ #ทั่วไป, ทีมตัวเอง และห้องที่เป็นสมาชิก ส่วน Admin/Manager เห็นทุกห้อง", async () => {
    mockPrisma.teamChatChannel.findFirst.mockResolvedValue({
      id: "ch-general",
      name: "ทั่วไป (General)",
      isGeneral: true,
      teamId: null,
    });
    mockPrisma.teamChatChannel.findUnique.mockResolvedValue({ id: "ch-team" });

    const now = new Date("2026-11-09T10:00:00Z");
    const earlier = new Date("2026-11-09T09:00:00Z");

    mockPrisma.teamChatChannel.findMany.mockResolvedValue([
      {
        id: "ch-general",
        name: "ทั่วไป (General)",
        description: "ห้องสนทนารวมทั้งบริษัท",
        isGeneral: true,
        teamId: null,
        updatedAt: now,
        members: [{ userId: "user-agent-1", lastReadAt: earlier }],
        messages: [{ id: "m-1", senderId: "user-admin", createdAt: now }],
      },
      {
        id: "ch-rent",
        name: "ทีมเช่า",
        description: "ห้องแชทประจำทีมเช่า",
        isGeneral: false,
        teamId: "team-rent",
        updatedAt: now,
        members: [{ userId: "user-agent-1", lastReadAt: now }],
        messages: [],
      },
      {
        id: "ch-sale",
        name: "ทีมขาย",
        description: "ห้องแชทประจำทีมขาย",
        isGeneral: false,
        teamId: "team-sale",
        updatedAt: now,
        members: [{ userId: "user-agent-2", lastReadAt: now }],
        messages: [],
      },
      {
        id: "ch-secret",
        name: "ดีลพิเศษ VIP",
        description: "เฉพาะกิจ",
        isGeneral: false,
        teamId: null,
        updatedAt: now,
        members: [{ userId: "user-agent-2", lastReadAt: now }],
        messages: [],
      },
    ]);

    const agentRes = await service.listChannels(makeUser());
    expect(agentRes.channels.map((c) => c.id)).toEqual(["ch-general", "ch-rent"]);
    expect(agentRes.channels[0]?.unreadCount).toBe(1);
    expect(agentRes.totalUnread).toBe(1);

    const adminRes = await service.listChannels(makeUser({ id: "user-admin", roles: ["ADMIN"], teamId: null }));
    expect(adminRes.channels.map((c) => c.id)).toEqual(["ch-general", "ch-rent", "ch-sale", "ch-secret"]);
  });

  it("บล็อกพนักงานที่ไม่ได้เป็นสมาชิกไม่ให้เปิดดูหรือส่งข้อความในห้องทีมอื่น", async () => {
    mockPrisma.teamChatChannel.findUnique.mockResolvedValue({
      id: "ch-sale",
      name: "ทีมขาย",
      isGeneral: false,
      teamId: "team-sale",
      archivedAt: null,
      members: [{ userId: "user-agent-2", lastReadAt: new Date() }],
    });

    await expect(service.getMessages(makeUser(), "ch-sale")).rejects.toThrow(ForbiddenException);
  });

  it("ส่งข้อความพร้อม @mention และไฟล์แนบ จะบันทึกข้อความและสร้าง Notification แจ้งเตือนผู้ถูกกล่าวถึง", async () => {
    mockPrisma.teamChatChannel.findUnique.mockResolvedValue({
      id: "ch-rent",
      name: "ทีมเช่า",
      isGeneral: false,
      teamId: "team-rent",
      archivedAt: null,
      members: [
        { userId: "user-agent-1", lastReadAt: new Date() },
        { userId: "user-admin", lastReadAt: new Date() },
      ],
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-agent-1",
      fullName: "สมชาย สายเช่า",
      nickname: "ชาย",
    });
    mockPrisma.teamChatMessage.create.mockResolvedValue({
      id: "msg-101",
      channelId: "ch-rent",
      senderId: "user-agent-1",
      senderName: "สมชาย สายเช่า",
      content: "สวัสดีครับ @แอดมิน รบกวนตรวจสัญญาครับ",
      attachments: [{ name: "contract.pdf", url: "/api/v1/files/f-1/raw", mimeType: "application/pdf" }],
      mentionedUserIds: ["user-admin", "user-agent-1"],
      createdAt: new Date("2026-11-09T10:30:00Z"),
    });

    const saved = await service.sendMessage(makeUser(), "ch-rent", {
      content: "สวัสดีครับ @แอดมิน รบกวนตรวจสัญญาครับ",
      attachments: [{ name: "contract.pdf", url: "/api/v1/files/f-1/raw", mimeType: "application/pdf" }],
      mentionedUserIds: ["user-admin", "user-agent-1"],
    });

    expect(saved.id).toBe("msg-101");
    expect(mockPrisma.notification.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-admin",
          event: "team_chat.mention",
          link: "/team-chat?channelId=ch-rent",
        }),
      }),
    );
  });
});
