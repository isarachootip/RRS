import { randomUUID } from "node:crypto";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { Env } from "../config/env";
import type { RequestMeta } from "../common/request-meta";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { randomToken, sha256 } from "./crypto";

/** ใช้ refresh token ที่เพิ่งถูกหมุนซ้ำภายในช่วงนี้ = แท็บอื่นของผู้ใช้เองขอพร้อมกัน ไม่ถือว่าถูกขโมย */
const RACE_GRACE_MS = 10_000;

export interface IssuedSession {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  refreshExpiresAt: Date;
}

/**
 * access token (JWT อายุสั้น ส่งใน body) + refresh token (สุ่ม เก็บ hash ใน DB ส่งใน httpOnly cookie)
 * refresh หมุนทุกครั้ง; ใช้ token เก่าซ้ำหลังพ้นช่วง grace = สงสัยถูกขโมย → เพิกถอนทั้ง family
 */
@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
    private readonly audit: AuditService,
  ) {}

  async signAccess(user: { id: string; email: string; roles: string[] }) {
    const expiresIn = this.config.get("ACCESS_TOKEN_TTL_SECONDS", { infer: true });
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email, roles: user.roles },
      { audience: "access", expiresIn },
    );
    return { accessToken, expiresIn };
  }

  /** token ชั่วคราวระหว่างล็อกอินกับขั้นยืนยัน 2FA (5 นาที) */
  signChallenge(userId: string) {
    return this.jwt.signAsync({ sub: userId }, { audience: "mfa", expiresIn: 300 });
  }

  async verifyChallenge(token: string): Promise<string> {
    try {
      const p = await this.jwt.verifyAsync<{ sub: string }>(token, { audience: "mfa" });
      return p.sub;
    } catch {
      throw new UnauthorizedException({
        code: "CHALLENGE_EXPIRED",
        message: "หมดเวลายืนยันตัวตน กรุณาเข้าสู่ระบบใหม่",
      });
    }
  }

  async issue(
    user: { id: string; email: string; roles: string[] },
    meta: RequestMeta,
    familyId = randomUUID(),
  ): Promise<IssuedSession> {
    const refresh = this.newRefresh();
    await this.prisma.refreshToken.create({
      data: { ...refresh.row, userId: user.id, familyId, ip: meta.ip, userAgent: meta.userAgent },
    });
    return { ...(await this.signAccess(user)), refreshToken: refresh.token, refreshExpiresAt: refresh.row.expiresAt };
  }

  async rotate(refreshToken: string | undefined, meta: RequestMeta): Promise<IssuedSession & { userId: string }> {
    if (!refreshToken) throw sessionExpired();
    const current = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(refreshToken) },
      include: { user: { include: { roles: { include: { role: true } } } } },
    });
    if (!current) throw sessionExpired();

    if (current.revokedAt) {
      const recentlyRotated = current.replacedById && Date.now() - current.revokedAt.getTime() < RACE_GRACE_MS;
      if (!recentlyRotated) {
        await this.revokeFamily(current.familyId);
        await this.audit.log({
          actorId: current.userId,
          action: "LOGOUT",
          entityType: "session",
          entityId: current.familyId,
          after: { reason: "refresh_token_reuse" },
          meta,
        });
      }
      throw sessionExpired();
    }
    const u = current.user;
    if (current.expiresAt < new Date() || !u.isActive || u.archivedAt) throw sessionExpired();

    const next = this.newRefresh();
    const rotated = await this.prisma.$transaction(async (tx) => {
      // คำขอหมุน token เดียวกันพร้อมกัน จะสำเร็จได้แค่คำขอเดียว
      const { count } = await tx.refreshToken.updateMany({
        where: { id: current.id, revokedAt: null },
        data: { revokedAt: new Date(), replacedById: next.row.id },
      });
      if (count === 0) return false;
      await tx.refreshToken.create({
        data: { ...next.row, userId: u.id, familyId: current.familyId, ip: meta.ip, userAgent: meta.userAgent },
      });
      return true;
    });
    if (!rotated) throw sessionExpired();

    const roles = u.roles.map((r) => r.role.code);
    return {
      ...(await this.signAccess({ id: u.id, email: u.email, roles })),
      refreshToken: next.token,
      refreshExpiresAt: next.row.expiresAt,
      userId: u.id,
    };
  }

  private newRefresh() {
    const token = randomToken();
    const expiresAt = new Date(Date.now() + this.config.get("REFRESH_TOKEN_TTL_DAYS", { infer: true }) * 86_400_000);
    return { token, row: { id: randomUUID(), tokenHash: sha256(token), expiresAt } };
  }

  async revokeByToken(refreshToken: string | undefined) {
    if (!refreshToken) return null;
    const t = await this.prisma.refreshToken.findUnique({ where: { tokenHash: sha256(refreshToken) } });
    if (!t) return null;
    await this.revokeFamily(t.familyId);
    return t;
  }

  revokeFamily(familyId: string) {
    return this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  revokeAllForUser(userId: string) {
    return this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  }
}

const sessionExpired = () =>
  new UnauthorizedException({ code: "SESSION_EXPIRED", message: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่" });
