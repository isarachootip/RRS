import { randomBytes } from "node:crypto";
import { Injectable, NotFoundException } from "@nestjs/common";
import { LineMessagingService } from "../notifications/line-messaging.service";
import { PrismaService } from "../prisma/prisma.service";
import type { IncomingExternalMessageInput } from "./chat.service";

@Injectable()
export class PublicChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly line: LineMessagingService,
  ) {}

  private genToken(): string {
    return randomBytes(12).toString("hex");
  }

  async getPublicRoom(token: string) {
    const room = await this.prisma.chatRoom.findUnique({
      where: { publicToken: token },
      include: { messages: { orderBy: { createdAt: "asc" }, take: 200 } },
    });
    if (!room) throw new NotFoundException({ code: "ROOM_NOT_FOUND", message: "ไม่พบลิงก์ห้องแชทนี้" });
    return {
      id: room.id,
      type: room.type,
      publicToken: room.publicToken,
      title: room.title,
      subtitle: room.subtitle,
      assetCode: room.assetCode,
      messages: room.messages,
    };
  }

  async sendPublicMessage(
    token: string,
    input: { senderName?: string; content: string; imageUrl?: string | null; assetCode?: string | null },
  ) {
    const room = await this.prisma.chatRoom.findUnique({ where: { publicToken: token } });
    if (!room) throw new NotFoundException({ code: "ROOM_NOT_FOUND", message: "ไม่พบลิงก์ห้องแชทนี้" });

    const senderType = room.type === "OWNER" ? "OWNER" : "CUSTOMER";
    const senderName = input.senderName?.trim() || room.title;
    const msg = await this.prisma.chatMessage.create({
      data: {
        roomId: room.id,
        senderType,
        senderName,
        content: input.content.trim(),
        imageUrl: input.imageUrl ?? null,
        assetCode: input.assetCode ?? room.assetCode ?? null,
      },
    });

    await this.prisma.chatRoom.update({
      where: { id: room.id },
      data: {
        lastMessageAt: new Date(),
        lastMessagePreview: input.content.trim().slice(0, 120),
        unreadCount: { increment: 1 },
      },
    });

    const roleLabel = room.type === "OWNER" ? "เจ้าของทรัพย์" : "ลูกค้า";
    await this.line.sendToAdmin(
      `💬 [${roleLabel}ทักแชทเว็บ] ${senderName}${room.assetCode ? ` (${room.assetCode})` : ""}\nข้อความ: ${input.content.trim()}`,
    );

    return msg;
  }

  async handleIncomingExternalMessage(input: IncomingExternalMessageInput) {
    const ownerCode = input.ownerCode ?? input.content.match(/OW-\d{3,10}/i)?.[0]?.toUpperCase() ?? null;
    const assetCode = input.assetCode ?? input.content.match(/PR-\d{3,10}/i)?.[0]?.toUpperCase() ?? null;
    const isOwnerMsg = input.type === "OWNER" || Boolean(ownerCode);

    let room = input.lineUserId
      ? await this.prisma.chatRoom.findFirst({
          where: { lineUserId: input.lineUserId, type: isOwnerMsg ? "OWNER" : "CUSTOMER" },
          orderBy: { lastMessageAt: "desc" },
        })
      : null;

    if (!room && ownerCode) {
      const owner = await this.prisma.owner.findFirst({ where: { code: ownerCode } });
      if (owner) {
        room = await this.prisma.chatRoom.findFirst({ where: { type: "OWNER", ownerId: owner.id } });
        if (!room) {
          room = await this.prisma.chatRoom.create({
            data: {
              type: "OWNER",
              publicToken: this.genToken(),
              title: owner.fullName,
              subtitle: `${owner.code}${owner.phone ? ` · ${owner.phone}` : ""}`,
              ownerId: owner.id,
              lineUserId: input.lineUserId ?? null,
              assetCode,
              assignedAgentId: owner.agentId ?? null,
              lastMessagePreview: input.content.slice(0, 120),
            },
          });
        } else if (input.lineUserId && !room.lineUserId) {
          room = await this.prisma.chatRoom.update({
            where: { id: room.id },
            data: { lineUserId: input.lineUserId },
          });
        }
      }
    }

    let isNewRoom = false;
    if (!room) {
      isNewRoom = true;
      const shortUid = input.lineUserId ? input.lineUserId.slice(-6) : "Web";
      room = await this.prisma.chatRoom.create({
        data: {
          type: isOwnerMsg ? "OWNER" : "CUSTOMER",
          publicToken: this.genToken(),
          title: input.senderName?.trim() || (isOwnerMsg ? `เจ้าของทรัพย์ (${shortUid})` : `ลูกค้า LINE (${shortUid})`),
          subtitle: assetCode ? `สนใจทรัพย์ ${assetCode}` : "ทักจาก LINE OA / หน้าเว็บ",
          lineUserId: input.lineUserId ?? null,
          assetCode,
          lastMessagePreview: input.content.slice(0, 120),
        },
      });
    }

    const msg = await this.prisma.chatMessage.create({
      data: {
        roomId: room.id,
        senderType: room.type === "OWNER" ? "OWNER" : "CUSTOMER",
        senderName: input.senderName?.trim() || room.title,
        content: input.content.trim(),
        imageUrl: input.imageUrl ?? null,
        assetCode: assetCode ?? room.assetCode ?? null,
      },
    });

    await this.prisma.chatRoom.update({
      where: { id: room.id },
      data: {
        lastMessageAt: new Date(),
        lastMessagePreview: input.content.trim().slice(0, 120),
        unreadCount: { increment: 1 },
        ...(assetCode && !room.assetCode ? { assetCode } : {}),
      },
    });

    // ส่งข้อความต้อนรับอัตโนมัติเฉพาะครั้งแรกที่สร้างห้องแชทใหม่เท่านั้น เพื่อไม่ให้บอทกวนตอนคุยจริง
    if (isNewRoom && input.replyToken) {
      const company = input.companyName || "RRS Real Estate";
      await this.line.replyMessage(
        input.replyToken,
        `สวัสดีครับ ขอบคุณที่ติดต่อ ${company}${assetCode ? ` (รหัสทรัพย์ ${assetCode})` : ""} ข้อความของคุณเข้าสู่ห้องแชทของเจ้าหน้าที่แล้ว สามารถพิมพ์พูดคุยต่อในแชทนี้ได้เลยครับ`,
      );
    }

    return { room, message: msg, isNewRoom };
  }
}
