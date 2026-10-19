import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Scope } from "@rrs/shared";
import { authenticator } from "otplib";
import { toDataURL } from "qrcode";
import { AuditService } from "../audit/audit.service";
import type { Env } from "../config/env";
import type { RequestMeta } from "../common/request-meta";
import { MailService } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";
import { MFA_REQUIRED_ROLES, type LoginResult, type MeResponse } from "./auth.types";
import { decryptSecret, encryptSecret, randomToken, sha256 } from "./crypto";
import { burnPasswordCheck, checkPasswordNotEmail, hashPassword, passwordSchema, verifyPassword } from "./password";
import { type IssuedSession, SessionService } from "./session.service";

// ยอมให้นาฬิกาโทรศัพท์คลาดได้ ±30 วินาที
authenticator.options = { window: 1 };

const SCOPE_RANK: Record<Scope, number> = { OWN: 1, TEAM: 2, ALL: 3 };
const RESET_TTL_MS = 30 * 60_000;

const userInclude = {
  roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
} as const;

export type LoginOutcome = { result: LoginResult; session?: IssuedSession };

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  // ---------------- ล็อกอิน ----------------

  async login(emailRaw: string, password: string, meta: RequestMeta): Promise<LoginOutcome> {
    const email = emailRaw.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email }, include: userInclude });

    if (!user) {
      await burnPasswordCheck(password);
      await this.audit.log({
        action: "LOGIN_FAILED",
        entityType: "user",
        after: { email, reason: "unknown_email" },
        meta,
      });
      throw invalidCredentials();
    }
    if (!user.isActive || user.archivedAt) {
      await this.audit.log({
        actorId: user.id,
        action: "LOGIN_FAILED",
        entityType: "user",
        entityId: user.id,
        after: { reason: "disabled" },
        meta,
      });
      throw new ForbiddenException({ code: "ACCOUNT_DISABLED", message: "บัญชีนี้ถูกปิดใช้งาน ติดต่อผู้ดูแลระบบ" });
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) throw accountLocked(user.lockedUntil);

    if (!(await verifyPassword(user.passwordHash, password))) {
      const max = this.config.get("LOGIN_MAX_ATTEMPTS", { infer: true });
      const failed = user.failedLoginCount + 1;
      const lock = failed >= max;
      const lockedUntil = lock
        ? new Date(Date.now() + this.config.get("LOGIN_LOCK_MINUTES", { infer: true }) * 60_000)
        : null;
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount: lock ? 0 : failed, lockedUntil: lockedUntil ?? user.lockedUntil },
      });
      await this.audit.log({
        actorId: user.id,
        action: "LOGIN_FAILED",
        entityType: "user",
        entityId: user.id,
        after: { reason: "wrong_password", attempt: failed, locked: lock },
        meta,
      });
      if (lockedUntil) throw accountLocked(lockedUntil);
      throw invalidCredentials();
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } });

    const roles = user.roles.map((r) => r.role.code);
    if (user.totpEnabled)
      return { result: { status: "MFA_REQUIRED", challengeToken: await this.sessions.signChallenge(user.id) } };
    if (roles.some((r) => MFA_REQUIRED_ROLES.includes(r))) {
      return { result: { status: "MFA_SETUP_REQUIRED", challengeToken: await this.sessions.signChallenge(user.id) } };
    }
    return this.completeLogin(user.id, meta, "password");
  }

  private async completeLogin(userId: string, meta: RequestMeta, method: "password" | "totp"): Promise<LoginOutcome> {
    const me = await this.me(userId);
    const session = await this.sessions.issue({ id: me.id, email: me.email, roles: me.roles }, meta);
    await this.prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
    await this.audit.log({
      actorId: userId,
      action: "LOGIN",
      entityType: "user",
      entityId: userId,
      after: { method },
      meta,
    });
    return {
      result: { status: "OK", accessToken: session.accessToken, expiresIn: session.expiresIn, user: me },
      session,
    };
  }

  // ---------------- 2FA (TOTP) ----------------

  /** สร้าง secret ใหม่ (ยังไม่เปิดใช้จนกว่าจะยืนยันรหัสแรก) */
  async mfaSetup(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.totpEnabled)
      throw new BadRequestException({ code: "MFA_ALREADY_ENABLED", message: "เปิดการยืนยันสองขั้นตอนไว้แล้ว" });
    const secret = authenticator.generateSecret();
    await this.prisma.user.update({ where: { id: userId }, data: { totpSecret: encryptSecret(secret, this.totpKey) } });
    const otpauthUrl = authenticator.keyuri(user.email, this.config.get("TOTP_ISSUER"), secret);
    return { secret, otpauthUrl, qrDataUrl: await toDataURL(otpauthUrl, { margin: 1, width: 220 }) };
  }

  async mfaEnable(
    userId: string,
    code: string,
    meta: RequestMeta,
    completeLogin: boolean,
  ): Promise<LoginOutcome | null> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.totpEnabled)
      throw new BadRequestException({ code: "MFA_ALREADY_ENABLED", message: "เปิดการยืนยันสองขั้นตอนไว้แล้ว" });
    if (!user.totpSecret)
      throw new BadRequestException({ code: "MFA_SETUP_FIRST", message: "กรุณาสแกน QR code ก่อนยืนยันรหัส" });
    if (!this.checkCode(user.totpSecret, code)) throw invalidCode();
    await this.prisma.user.update({ where: { id: userId }, data: { totpEnabled: true } });
    await this.audit.log({
      actorId: userId,
      action: "UPDATE",
      entityType: "user",
      entityId: userId,
      after: { totpEnabled: true },
      meta,
    });
    return completeLogin ? this.completeLogin(userId, meta, "totp") : null;
  }

  async mfaVerify(userId: string, code: string, meta: RequestMeta): Promise<LoginOutcome> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.totpEnabled || !user.totpSecret)
      throw new BadRequestException({ code: "MFA_NOT_ENABLED", message: "บัญชีนี้ยังไม่ได้เปิดการยืนยันสองขั้นตอน" });
    if (!this.checkCode(user.totpSecret, code)) {
      await this.audit.log({
        actorId: userId,
        action: "LOGIN_FAILED",
        entityType: "user",
        entityId: userId,
        after: { reason: "wrong_totp" },
        meta,
      });
      throw invalidCode();
    }
    return this.completeLogin(userId, meta, "totp");
  }

  private checkCode(encrypted: string, code: string) {
    return authenticator.check(code.replace(/\s/g, ""), decryptSecret(encrypted, this.totpKey));
  }

  private get totpKey() {
    return this.config.get("TOTP_ENCRYPTION_KEY");
  }

  // ---------------- รหัสผ่าน ----------------

  /** ตอบเหมือนกันเสมอ ไม่บอกว่ามีอีเมลนี้หรือไม่ */
  async forgotPassword(emailRaw: string, meta: RequestMeta) {
    const email = emailRaw.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user && user.isActive && !user.archivedAt) {
      const token = randomToken();
      await this.prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + RESET_TTL_MS) },
      });
      const link = `${this.config.get("WEB_ORIGIN")}/reset-password?token=${token}`;
      await this.mail.send({
        to: user.email,
        subject: "ตั้งรหัสผ่านใหม่สำหรับ RRS",
        text: `สวัสดีคุณ${user.fullName}\n\nกดลิงก์นี้เพื่อตั้งรหัสผ่านใหม่ ลิงก์ใช้ได้ครั้งเดียวภายใน 30 นาที:\n${link}\n\nถ้าคุณไม่ได้ขอ ไม่ต้องทำอะไร รหัสผ่านเดิมยังใช้ได้`,
      });
      await this.audit.log({
        actorId: user.id,
        action: "UPDATE",
        entityType: "user",
        entityId: user.id,
        after: { passwordResetRequested: true },
        meta,
      });
    }
  }

  async resetPassword(token: string, password: string, meta: RequestMeta) {
    const row = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: sha256(token) },
      include: { user: true },
    });
    if (!row || row.usedAt || row.expiresAt < new Date()) {
      throw new BadRequestException({
        code: "RESET_LINK_INVALID",
        message: "ลิงก์นี้หมดอายุหรือถูกใช้ไปแล้ว กรุณาขอลิงก์ใหม่",
      });
    }
    this.assertPassword(password, row.user.email);
    const passwordHash = await hashPassword(password);
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
      // ลิงก์อื่นที่ขอไว้ก่อนหน้าใช้ไม่ได้แล้ว
      this.prisma.passwordResetToken.updateMany({
        where: { userId: row.userId, usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: row.userId },
        data: { passwordHash, failedLoginCount: 0, lockedUntil: null },
      }),
    ]);
    await this.sessions.revokeAllForUser(row.userId);
    await this.audit.log({
      actorId: row.userId,
      action: "UPDATE",
      entityType: "user",
      entityId: row.userId,
      after: { passwordReset: true },
      meta,
    });
  }

  async changePassword(userId: string, current: string, next: string, meta: RequestMeta) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await verifyPassword(user.passwordHash, current))) {
      throw new BadRequestException({ code: "WRONG_PASSWORD", message: "รหัสผ่านปัจจุบันไม่ถูกต้อง" });
    }
    this.assertPassword(next, user.email);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(next) } });
    await this.sessions.revokeAllForUser(userId);
    await this.audit.log({
      actorId: userId,
      action: "UPDATE",
      entityType: "user",
      entityId: userId,
      after: { passwordChanged: true },
      meta,
    });
  }

  private assertPassword(password: string, email: string) {
    const r = passwordSchema.safeParse(password);
    const msg = r.success ? checkPasswordNotEmail(password, email) : r.error.issues[0]?.message;
    if (msg) throw new BadRequestException({ code: "WEAK_PASSWORD", message: msg });
  }

  // ---------------- ข้อมูลผู้ใช้ ----------------

  async me(userId: string): Promise<MeResponse> {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, include: userInclude });
    const permissions: Record<string, Scope> = {};
    for (const ur of u.roles) {
      for (const rp of ur.role.permissions) {
        const prev = permissions[rp.permission.code];
        if (!prev || SCOPE_RANK[rp.scope] > SCOPE_RANK[prev]) permissions[rp.permission.code] = rp.scope;
      }
    }
    const roles = u.roles.map((r) => r.role.code);
    return {
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      teamId: u.teamId,
      roles,
      permissions,
      totpEnabled: u.totpEnabled,
      mfaRequired: roles.some((r) => MFA_REQUIRED_ROLES.includes(r)),
    };
  }
}

const invalidCredentials = () =>
  new UnauthorizedException({ code: "INVALID_CREDENTIALS", message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" });

const invalidCode = () =>
  new UnauthorizedException({ code: "INVALID_MFA_CODE", message: "รหัสยืนยันไม่ถูกต้องหรือหมดเวลา ลองรหัสใหม่จากแอป" });

function accountLocked(until: Date) {
  const time = until.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });
  return new HttpException(
    {
      code: "ACCOUNT_LOCKED",
      message: `บัญชีถูกล็อกชั่วคราวเพราะใส่รหัสผ่านผิดหลายครั้ง ลองใหม่ได้หลังเวลา ${time} น. หรือตั้งรหัสผ่านใหม่`,
      details: { lockedUntil: until.toISOString() },
    },
    HttpStatus.LOCKED,
  );
}
