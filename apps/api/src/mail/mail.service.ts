import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { type Transporter, createTransport } from "nodemailer";
import type { Env } from "../config/env";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

/**
 * ส่งอีเมล: MAIL_TRANSPORT=log (ค่าเริ่มต้นตอนพัฒนา) แสดงใน log และเก็บไว้ใน outbox
 * MAIL_TRANSPORT=smtp ส่งจริงผ่าน SMTP_URL
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger("Mail");
  private readonly transporter?: Transporter;
  /** อีเมลที่ "ส่ง" ในโหมด log — ใช้ในเทสต์ */
  readonly outbox: MailMessage[] = [];

  constructor(private readonly config: ConfigService<Env, true>) {
    if (config.get("MAIL_TRANSPORT") === "smtp") {
      this.transporter = createTransport(config.get("SMTP_URL"));
    }
  }

  async send(msg: MailMessage) {
    if (!this.transporter) {
      this.outbox.push(msg);
      this.logger.log(`[ไม่ได้ส่งจริง] ถึง ${msg.to}: ${msg.subject}\n${msg.text}`);
      return;
    }
    await this.transporter.sendMail({ from: this.config.get("MAIL_FROM"), ...msg });
  }
}
