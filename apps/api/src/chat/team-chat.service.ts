import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@rrs/db";
import type { AuthUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";

export interface TeamChatAttachmentInput {
  name: string;
  url: string;
  mimeType: string;
}

export interface CreateTeamChannelInput {
  name: string;
  description?: string | null;
  memberIds?: string[];
}

export interface SendTeamChatMessageInput {
  content: string;
  attachments?: TeamChatAttachmentInput[];
  mentionedUserIds?: string[];
}

@Injectable()
export class TeamChatService {
  constructor(private readonly prisma: PrismaService) {}

  private isStaffAdminOrManager(user: AuthUser): boolean {
    return user.roles.includes("ADMIN") || user.roles.includes("MANAGER");
  }

  private async ensureDefaultAndTeamChannels(users: Array<{ id: string; teamId: string | null }>) {
    const general = await this.prisma.teamChatChannel.findFirst({ where: { isGeneral: true, archivedAt: null } });
    if (!general) {
      await this.prisma.teamChatChannel.create({
        data: { name: "ทั่วไป (General)", description: "ห้องสนทนาและประกาศรวมทั้งบริษัท", isGeneral: true },
      });
    }
    const teams = await this.prisma.team.findMany({
      where: { archivedAt: null },
      select: { id: true, name: true, managerId: true },
    });
    for (const team of teams) {
      const existing = await this.prisma.teamChatChannel.findUnique({ where: { teamId: team.id } });
      if (!existing) {
        const memberIds = new Set<string>(users.filter((u) => u.teamId === team.id).map((u) => u.id));
        if (team.managerId) memberIds.add(team.managerId);
        await this.prisma.teamChatChannel.create({
          data: {
            name: team.name,
            description: `ห้องสนทนาประจำทีม ${team.name}`,
            teamId: team.id,
            members: { create: Array.from(memberIds).map((userId) => ({ userId })) },
          },
        });
      }
    }
  }

  private canAccessChannel(
    user: AuthUser,
    channel: { isGeneral: boolean; teamId: string | null; members: Array<{ userId: string }> },
  ): boolean {
    if (this.isStaffAdminOrManager(user) || channel.isGeneral) return true;
    if (channel.teamId && user.teamId === channel.teamId) return true;
    return channel.members.some((m) => m.userId === user.id);
  }

  async listChannels(user: AuthUser) {
    const activeUsers = await this.prisma.user.findMany({
      where: { isActive: true, archivedAt: null },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, nickname: true, email: true, teamId: true },
    });

    await this.ensureDefaultAndTeamChannels(activeUsers);

    const allChannels = await this.prisma.teamChatChannel.findMany({
      where: { archivedAt: null },
      include: {
        members: { select: { userId: true, lastReadAt: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 50, select: { id: true, senderId: true, createdAt: true } },
      },
      orderBy: [{ isGeneral: "desc" }, { updatedAt: "desc" }],
    });

    const visible = allChannels.filter((c) => this.canAccessChannel(user, c));

    const channels = visible.map((c) => {
      const memberSet = new Set<string>();
      if (c.isGeneral) {
        activeUsers.forEach((u) => memberSet.add(u.id));
      } else {
        c.members.forEach((m) => memberSet.add(m.userId));
        if (c.teamId) activeUsers.filter((u) => u.teamId === c.teamId).forEach((u) => memberSet.add(u.id));
      }

      const lastRead = c.members.find((m) => m.userId === user.id)?.lastReadAt ?? new Date(0);
      const unreadCount = c.messages.filter((m) => m.senderId !== user.id && m.createdAt > lastRead).length;

      return {
        id: c.id,
        name: c.name,
        description: c.description ?? null,
        isGeneral: c.isGeneral,
        teamId: c.teamId ?? null,
        memberIds: Array.from(memberSet),
        memberCount: memberSet.size,
        unreadCount,
        updatedAt: c.updatedAt,
      };
    });
    const totalUnread = channels.reduce((sum, c) => sum + c.unreadCount, 0);
    return { channels, users: activeUsers, totalUnread };
  }

  async createChannel(user: AuthUser, input: CreateTeamChannelInput) {
    const memberSet = new Set<string>([user.id, ...(input.memberIds ?? [])]);
    return this.prisma.teamChatChannel.create({
      data: {
        name: input.name.trim(),
        description: input.description?.trim() || "ห้องสนทนาเฉพาะกิจ",
        createdById: user.id,
        members: { create: Array.from(memberSet).map((userId) => ({ userId })) },
      },
    });
  }

  private async getAccessibleChannel(user: AuthUser, channelId: string) {
    const channel = await this.prisma.teamChatChannel.findUnique({
      where: { id: channelId },
      include: { members: { select: { userId: true, lastReadAt: true } } },
    });
    if (!channel || channel.archivedAt) {
      throw new NotFoundException({ code: "CHANNEL_NOT_FOUND", message: "ไม่พบห้องแชททีมนี้" });
    }
    if (!this.canAccessChannel(user, channel)) {
      throw new ForbiddenException({ code: "FORBIDDEN", message: "ไม่มีสิทธิ์เข้าถึงห้องแชททีมนี้" });
    }
    return channel;
  }

  async getMessages(user: AuthUser, channelId: string) {
    await this.getAccessibleChannel(user, channelId);
    await this.prisma.teamChatMember.upsert({
      where: { channelId_userId: { channelId, userId: user.id } },
      create: { channelId, userId: user.id, lastReadAt: new Date() },
      update: { lastReadAt: new Date() },
    });
    const items = await this.prisma.teamChatMessage.findMany({
      where: { channelId },
      orderBy: { createdAt: "asc" },
      take: 300,
    });
    return { items };
  }

  async sendMessage(user: AuthUser, channelId: string, input: SendTeamChatMessageInput) {
    const channel = await this.getAccessibleChannel(user, channelId);
    const senderProfile = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { fullName: true, nickname: true },
    });
    const senderName = senderProfile?.fullName ?? user.email.split("@")[0] ?? "Staff";
    const attachments = input.attachments ?? [];
    const mentionedUserIds = Array.from(new Set(input.mentionedUserIds ?? []));
    const saved = await this.prisma.teamChatMessage.create({
      data: {
        channelId,
        senderId: user.id,
        senderName,
        content: input.content.trim() || " ",
        attachments: attachments as unknown as Prisma.InputJsonValue,
        mentionedUserIds,
      },
    });
    await Promise.all([
      this.prisma.teamChatChannel.update({ where: { id: channelId }, data: { updatedAt: new Date() } }),
      this.prisma.teamChatMember.upsert({
        where: { channelId_userId: { channelId, userId: user.id } },
        create: { channelId, userId: user.id, lastReadAt: new Date() },
        update: { lastReadAt: new Date() },
      }),
    ]);
    for (const targetUserId of mentionedUserIds) {
      if (targetUserId === user.id) continue;
      await this.prisma.notification.create({
        data: {
          userId: targetUserId,
          event: "team_chat.mention",
          title: `${senderName} กล่าวถึงคุณใน #${channel.name}`,
          body: input.content.trim().slice(0, 160),
          link: `/team-chat?channelId=${channel.id}`,
          delivery: { IN_APP: "sent" } as Prisma.InputJsonValue,
        },
      });
    }
    return saved;
  }
}
