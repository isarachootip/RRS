import { EventEmitter } from "node:events";
import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@rrs/db";
import { Observable, Subject, filter, map } from "rxjs";
import { MailService } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";
import { LineMessagingService } from "./line-messaging.service";
import {
  ensureDefaultNotificationRules,
  resolveEffectiveChannels,
  resolveRecipientsForRule,
} from "./notifications-recipients.helper";
import type {
  NotificationChannelType,
  NotificationEventPayload,
  NotificationJobData,
  SseNotificationMessage,
} from "./notifications.types";

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

@Injectable()
export class NotificationsDispatcherService {
  private readonly logger = new Logger("NotificationsDispatcher");
  readonly eventBus = new EventEmitter();
  private readonly sseSubject = new Subject<SseNotificationMessage>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly line: LineMessagingService,
  ) {
    this.eventBus.on("notification.event", (payload: NotificationEventPayload) => {
      void this.dispatchEvent(payload).catch((err) => {
        this.logger.error(`Error dispatching notification event ${payload.event}`, err);
      });
    });
  }

  streamForUser(userId: string): Observable<{ data: SseNotificationMessage["notification"] }> {
    return this.sseSubject.asObservable().pipe(
      filter((msg) => msg.userId === userId),
      map((msg) => ({ data: msg.notification })),
    );
  }

  /** ส่งเหตุการณ์ผ่าน Event Bus และรอผลลัพธ์ (รองรับทั้งเรียกตรงและผ่าน EventEmitter) */
  async dispatchEvent(payload: NotificationEventPayload): Promise<{
    sentCount: number;
    skippedDuplicateCount: number;
  }> {
    await ensureDefaultNotificationRules(this.prisma);
    const rule = await this.prisma.notificationRule.findUnique({
      where: { event: payload.event },
    });
    if (!rule || !rule.isEnabled) {
      return { sentCount: 0, skippedDuplicateCount: 0 };
    }

    const recipientTokens = payload.overrideRecipients ?? rule.recipients;
    const recipients = await resolveRecipientsForRule(this.prisma, recipientTokens, payload.context);

    const ruleChannels = rule.channels as NotificationChannelType[];
    let sentCount = 0;
    let skippedDuplicateCount = 0;

    for (const user of recipients) {
      const channels = resolveEffectiveChannels(ruleChannels, user.notificationPrefs, payload.event);
      if (channels.length === 0) continue;

      const dedupeKey = `${payload.dedupeBaseKey}:${user.id}`;
      const res = await this.processJob({
        userId: user.id,
        email: user.email,
        lineUserId: user.lineUserId,
        event: payload.event,
        title: payload.title,
        body: payload.body,
        link: payload.link,
        dedupeKey,
        channels,
      });

      if (res.duplicate) {
        skippedDuplicateCount++;
      } else {
        sentCount++;
      }
    }

    return { sentCount, skippedDuplicateCount };
  }

  async processJob(job: NotificationJobData): Promise<{ duplicate: boolean; id?: string }> {
    const existing = await this.prisma.notification.findUnique({
      where: { dedupeKey: job.dedupeKey },
      select: { id: true },
    });
    if (existing) {
      return { duplicate: true, id: existing.id };
    }

    const delivery: Record<string, string> = {};
    if (job.channels.includes("IN_APP")) {
      delivery.IN_APP = "sent";
    }

    let created;
    try {
      created = await this.prisma.notification.create({
        data: {
          userId: job.userId,
          event: job.event,
          title: job.title,
          body: job.body ?? null,
          link: job.link ?? null,
          dedupeKey: job.dedupeKey,
          delivery: delivery as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return { duplicate: true };
      }
      throw err;
    }

    if (job.channels.includes("EMAIL")) {
      try {
        await withRetry(
          () =>
            this.mail.send({
              to: job.email,
              subject: `[RRS] ${job.title}`,
              text: [job.title, job.body, job.link ? `ลิงก์: ${job.link}` : ""].filter(Boolean).join("\n"),
            }),
          3,
        );
        delivery.EMAIL = "sent";
      } catch (err) {
        this.logger.warn(`Failed EMAIL delivery after 3 attempts for ${job.dedupeKey}: ${String(err)}`);
        delivery.EMAIL = "failed";
      }
    }

    if (job.channels.includes("LINE")) {
      if (!job.lineUserId) {
        delivery.LINE = "skipped_no_line_id";
      } else {
        try {
          const lineUid = job.lineUserId;
          const status = await withRetry(
            () => this.line.sendPush(lineUid, [job.title, job.body].filter(Boolean).join("\n")),
            3,
          );
          delivery.LINE = status;
        } catch (err) {
          this.logger.warn(`Failed LINE delivery after 3 attempts for ${job.dedupeKey}: ${String(err)}`);
          delivery.LINE = "failed";
        }
      }
    }

    await this.prisma.notification.update({
      where: { id: created.id },
      data: { delivery: delivery as Prisma.InputJsonValue },
    });

    if (job.channels.includes("IN_APP")) {
      this.sseSubject.next({
        userId: job.userId,
        notification: {
          id: created.id,
          event: created.event,
          title: created.title,
          body: created.body,
          link: created.link,
          readAt: created.readAt ? created.readAt.toISOString() : null,
          createdAt: created.createdAt.toISOString(),
        },
      });
    }

    return { duplicate: false, id: created.id };
  }
}
