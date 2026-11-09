import { randomBytes } from "node:crypto";
import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { AuthUser } from "../auth/auth.types";
import { LineMessagingService } from "../notifications/line-messaging.service";
import { PrismaService } from "../prisma/prisma.service";

export interface IncomingExternalMessageInput {
  type?: "CUSTOMER" | "OWNER";
  lineUserId?: string;
  publicToken?: string;
  senderName?: string;
  content: string;
  imageUrl?: string | null;
  assetCode?: string | null;
  ownerCode?: string | null;
  replyToken?: string;
  companyName?: string;
  adminLineUserId?: string;
}

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly line: LineMessagingService,
  ) {}

  private isStaffAdminOrManager(user: AuthUser): boolean {
    return user.roles.includes("ADMIN") || user.roles.includes("MANAGER");
  }

  private genToken(): string {
    return randomBytes(12).toString("hex");
  }

  async listRooms(user: AuthUser, type?: "CUSTOMER" | "OWNER") {
    const isAll = this.isStaffAdminOrManager(user);
    const scopeFilter = isAll ? {} : { OR: [{ assignedAgentId: user.id }, { assignedAgentId: null }] };

    const [rooms, customerUnreadAgg, ownerUnreadAgg] = await Promise.all([
      this.prisma.chatRoom.findMany({
        where: { ...(type ? { type } : {}), ...scopeFilter },
        orderBy: { lastMessageAt: "desc" },
        take: 100,
      }),
      this.prisma.chatRoom.aggregate({
        where: { type: "CUSTOMER", ...scopeFilter },
        _sum: { unreadCount: true },
      }),
      this.prisma.chatRoom.aggregate({
        where: { type: "OWNER", ...scopeFilter },
        _sum: { unreadCount: true },
      }),
    ]);

    const customerUnread = customerUnreadAgg._sum.unreadCount ?? 0;
    const ownerUnread = ownerUnreadAgg._sum.unreadCount ?? 0;
    return {
      items: rooms,
      unreadSummary: {
        customerUnread,
        ownerUnread,
        totalUnread: customerUnread + ownerUnread,
      },
    };
  }

  async getRoomDetail(user: AuthUser, roomId: string) {
    const room = await this.prisma.chatRoom.findUnique({
      where: { id: roomId },
      include: { messages: { orderBy: { createdAt: "asc" }, take: 200 } },
    });
    if (!room) throw new NotFoundException({ code: "ROOM_NOT_FOUND", message: "ไม่พบห้องแชทนี้" });
    if (!this.isStaffAdminOrManager(user) && room.assignedAgentId && room.assignedAgentId !== user.id) {
      throw new ForbiddenException({ code: "FORBIDDEN", message: "ไม่มีสิทธิ์เข้าถึงห้องแชทนี้" });
    }
    if (room.unreadCount > 0) {
      await this.prisma.chatRoom.update({ where: { id: roomId }, data: { unreadCount: 0 } });
    }
    return room;
  }

  async createOrGetOwnerRoom(user: AuthUser, ownerId: string, assetCode?: string | null) {
    const owner = await this.prisma.owner.findUnique({ where: { id: ownerId } });
    if (!owner) throw new NotFoundException({ code: "OWNER_NOT_FOUND", message: "ไม่พบข้อมูลเจ้าของทรัพย์สิน" });

    const existing = await this.prisma.chatRoom.findFirst({
      where: { type: "OWNER", ownerId: owner.id },
      orderBy: { lastMessageAt: "desc" },
    });
    if (existing) {
      if (assetCode && existing.assetCode !== assetCode) {
        return this.prisma.chatRoom.update({ where: { id: existing.id }, data: { assetCode } });
      }
      return existing;
    }

    const lineUid = owner.lineId?.startsWith("U") ? owner.lineId : null;
    const room = await this.prisma.chatRoom.create({
      data: {
        type: "OWNER",
        publicToken: this.genToken(),
        title: owner.fullName,
        subtitle: `${owner.code}${owner.phone ? ` · ${owner.phone}` : ""}`,
        ownerId: owner.id,
        lineUserId: lineUid,
        assetCode: assetCode ?? null,
        assignedAgentId: owner.agentId ?? user.id,
        lastMessagePreview: "เริ่มห้องแชทประสานงานกับเจ้าของทรัพย์สิน",
      },
    });
    await this.prisma.chatMessage.create({
      data: {
        roomId: room.id,
        senderType: "SYSTEM",
        senderName: "ระบบ",
        content: `เปิดห้องแชทสำหรับคุยกับเจ้าของทรัพย์ ${owner.fullName} (${owner.code}) สามารถคัดลอกลิงก์ห้องแชทส่งให้เจ้าของทรัพย์คุยผ่านเว็บได้ทันที`,
      },
    });
    return room;
  }

  async createCustomerRoom(
    user: AuthUser,
    input: { title: string; subtitle?: string | null; assetCode?: string | null; lineUserId?: string | null },
  ) {
    return this.prisma.chatRoom.create({
      data: {
        type: "CUSTOMER",
        publicToken: this.genToken(),
        title: input.title.trim(),
        subtitle: input.subtitle?.trim() || "ลูกค้าติดต่อสอบถาม",
        assetCode: input.assetCode?.trim() || null,
        lineUserId: input.lineUserId?.trim() || null,
        assignedAgentId: user.id,
        lastMessagePreview: "เปิดห้องแชทลูกค้า",
      },
    });
  }

  async updateRoomMeta(roomId: string, data: { lineUserId?: string | null; assetCode?: string | null }) {
    return this.prisma.chatRoom.update({
      where: { id: roomId },
      data: {
        ...(data.lineUserId !== undefined ? { lineUserId: data.lineUserId?.trim() || null } : {}),
        ...(data.assetCode !== undefined ? { assetCode: data.assetCode?.trim() || null } : {}),
      },
    });
  }

  async sendStaffMessage(
    user: AuthUser,
    roomId: string,
    input: { content: string; imageUrl?: string | null; assetCode?: string | null },
  ) {
    const room = await this.prisma.chatRoom.findUnique({ where: { id: roomId } });
    if (!room) throw new NotFoundException({ code: "ROOM_NOT_FOUND", message: "ไม่พบห้องแชทนี้" });

    const senderName = user.email.split("@")[0] ?? "Admin";
    const msg = await this.prisma.chatMessage.create({
      data: {
        roomId,
        senderType: "STAFF",
        senderUserId: user.id,
        senderName,
        content: input.content.trim(),
        imageUrl: input.imageUrl ?? null,
        assetCode: input.assetCode ?? room.assetCode ?? null,
      },
    });

    await this.prisma.chatRoom.update({
      where: { id: roomId },
      data: {
        lastMessageAt: new Date(),
        lastMessagePreview: input.content.trim().slice(0, 120),
        unreadCount: 0,
        ...(input.assetCode ? { assetCode: input.assetCode } : {}),
      },
    });

    if (room.lineUserId) {
      const prefix = input.assetCode ? `[ทรัพย์ ${input.assetCode}] ` : "";
      await this.line.sendPush(room.lineUserId, `${prefix}${input.content.trim()}`).catch(() => undefined);
    }
    return msg;
  }
}
