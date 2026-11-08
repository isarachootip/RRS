import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../config/env";

export interface LinePushMessage {
  to: string;
  text: string;
}

@Injectable()
export class LineMessagingService {
  private readonly logger = new Logger("LineMessaging");
  readonly outbox: LinePushMessage[] = [];
  private customHandler?: (msg: LinePushMessage) => Promise<void>;

  constructor(private readonly config: ConfigService<Env, true>) {}

  /** สำหรับเทสต์จำลองความล้มเหลวชั่วคราว (retry test) */
  setCustomHandler(handler?: (msg: LinePushMessage) => Promise<void>) {
    this.customHandler = handler;
  }

  async sendPush(toLineUserId: string, text: string): Promise<"sent" | "skipped"> {
    const msg: LinePushMessage = { to: toLineUserId, text };

    if (this.customHandler) {
      await this.customHandler(msg);
      this.outbox.push(msg);
      return "sent";
    }

    const transport = this.config.get("LINE_TRANSPORT", { infer: true });
    const token = this.config.get("LINE_CHANNEL_ACCESS_TOKEN", { infer: true });

    if (transport === "log") {
      this.outbox.push(msg);
      this.logger.log(`[LINE log] ถึง ${toLineUserId}: ${text}`);
      return "sent";
    }

    if (!token) {
      this.logger.warn("ข้ามการส่ง LINE เนื่องจากไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN ใน .env");
      return "skipped";
    }

    const res = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        to: toLineUserId,
        messages: [{ type: "text", text }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`LINE Messaging API error (${res.status}): ${errText}`);
    }

    this.outbox.push(msg);
    return "sent";
  }

  async sendToAdmin(text: string, overrideUserId?: string): Promise<"sent" | "skipped"> {
    const adminUid = overrideUserId?.trim() || this.config.get("LINE_ADMIN_USER_ID", { infer: true });
    if (!adminUid) return "skipped";
    try {
      return await this.sendPush(adminUid, text);
    } catch (err) {
      this.logger.warn(`Failed sendToAdmin (${adminUid}): ${String(err)}`);
      return "skipped";
    }
  }

  async replyMessage(replyToken: string, text: string): Promise<"sent" | "skipped"> {
    const transport = this.config.get("LINE_TRANSPORT", { infer: true });
    const token = this.config.get("LINE_CHANNEL_ACCESS_TOKEN", { infer: true });
    if (transport === "log" || !token || !replyToken) return "skipped";

    const res = await fetch("https://api.line.me/v2/bot/message/reply", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        replyToken,
        messages: [{ type: "text", text }],
      }),
    });
    return res.ok ? "sent" : "skipped";
  }
}
