import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@rrs/db";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsDispatcherService } from "./notifications-dispatcher.service";
import { ensureDefaultNotificationRules, parseNotificationPrefs } from "./notifications-recipients.helper";
import { NotificationsSchedulerService } from "./notifications-scheduler.service";
import type {
  LinkLineDto,
  ListNotificationsQueryDto,
  NotificationEventPayload,
  UpdateNotificationPrefsDto,
  UpdateNotificationRuleDto,
} from "./notifications.types";

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dispatcher: NotificationsDispatcherService,
    private readonly scheduler: NotificationsSchedulerService,
  ) {}

  streamForUser(userId: string) {
    return this.dispatcher.streamForUser(userId);
  }

  async listForUser(userId: string, query: ListNotificationsQueryDto) {
    const unreadOnly = query.unreadOnly === "true";
    const take = query.limit ?? 30;
    const [items, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: {
          userId,
          ...(unreadOnly ? { readAt: null } : {}),
        },
        orderBy: { createdAt: "desc" },
        take,
      }),
      this.prisma.notification.count({
        where: { userId, readAt: null },
      }),
    ]);

    return { items, unreadCount };
  }

  async markRead(userId: string, id: string) {
    const n = await this.prisma.notification.findFirst({
      where: { id, userId },
    });
    if (!n) throw new NotFoundException("ไม่พบรายการแจ้งเตือน");
    if (n.readAt) return n;
    return this.prisma.notification.update({
      where: { id: n.id },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(userId: string) {
    const res = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updatedCount: res.count };
  }

  async getPreferences(userId: string) {
    await ensureDefaultNotificationRules(this.prisma);
    const [user, rules] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { lineUserId: true, notificationPrefs: true },
      }),
      this.prisma.notificationRule.findMany({
        orderBy: { event: "asc" },
      }),
    ]);

    return {
      lineUserId: user.lineUserId,
      preferences: parseNotificationPrefs(user.notificationPrefs),
      rules,
    };
  }

  async updatePreferences(userId: string, dto: UpdateNotificationPrefsDto) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        notificationPrefs: dto.preferences as Prisma.InputJsonValue,
        updatedById: userId,
      },
      select: { lineUserId: true, notificationPrefs: true },
    });

    return {
      lineUserId: updated.lineUserId,
      preferences: parseNotificationPrefs(updated.notificationPrefs),
    };
  }

  async linkLine(userId: string, dto: LinkLineDto) {
    try {
      const updated = await this.prisma.user.update({
        where: { id: userId },
        data: { lineUserId: dto.lineUserId, updatedById: userId },
        select: { id: true, lineUserId: true },
      });
      return updated;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("บัญชี LINE นี้ถูกผูกกับผู้ใช้อื่นแล้ว");
      }
      throw err;
    }
  }

  async unlinkLine(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { lineUserId: null, updatedById: userId },
      select: { id: true, lineUserId: true },
    });
  }

  async listRules() {
    await ensureDefaultNotificationRules(this.prisma);
    const items = await this.prisma.notificationRule.findMany({
      orderBy: { event: "asc" },
    });
    return { items };
  }

  async updateRule(actorId: string, event: string, dto: UpdateNotificationRuleDto) {
    await ensureDefaultNotificationRules(this.prisma);
    const existing = await this.prisma.notificationRule.findUnique({ where: { event } });
    if (!existing) throw new NotFoundException(`ไม่พบกฎการแจ้งเตือน ${event}`);

    return this.prisma.notificationRule.update({
      where: { event },
      data: {
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.isEnabled !== undefined ? { isEnabled: dto.isEnabled } : {}),
        ...(dto.recipients !== undefined ? { recipients: dto.recipients } : {}),
        ...(dto.timing !== undefined ? { timing: dto.timing as Prisma.InputJsonValue } : {}),
        ...(dto.channels !== undefined ? { channels: dto.channels } : {}),
        updatedById: actorId,
      },
    });
  }

  emitEvent(payload: NotificationEventPayload) {
    return this.dispatcher.dispatchEvent(payload);
  }

  runScheduledChecks(now?: Date) {
    return this.scheduler.runScheduledChecks(now);
  }
}
