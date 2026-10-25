import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { normalizePhone } from "@rrs/shared";
import { AuditService } from "../audit/audit.service";
import { checkPasswordNotEmail, hashPassword, passwordSchema } from "../auth/password";
import { SessionService } from "../auth/session.service";
import type { RequestMeta } from "../common/request-meta";
import { PrismaService } from "../prisma/prisma.service";
import { PermissionCacheService } from "./permission-cache.service";

export interface CreateUserInput {
  email: string;
  fullName: string;
  password: string;
  nickname?: string | null;
  phone?: string | null;
  teamId?: string | null;
  isFreelance?: boolean;
  roleIds: string[];
}

export interface UpdateUserInput {
  fullName?: string;
  nickname?: string | null;
  phone?: string | null;
  teamId?: string | null;
  isActive?: boolean;
  isFreelance?: boolean;
  roleIds?: string[];
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly sessions: SessionService,
    private readonly cache: PermissionCacheService,
  ) {}

  async list() {
    const users = await this.prisma.user.findMany({
      where: { archivedAt: null },
      orderBy: { createdAt: "asc" },
      include: {
        team: { select: { id: true, name: true } },
        roles: { include: { role: { select: { id: true, code: true, name: true } } } },
      },
    });
    return {
      items: users.map((u) => ({
        id: u.id,
        email: u.email,
        fullName: u.fullName,
        nickname: u.nickname,
        phone: u.phone,
        teamId: u.teamId,
        teamName: u.team?.name ?? null,
        isActive: u.isActive,
        isFreelance: u.isFreelance,
        totpEnabled: u.totpEnabled,
        lastLoginAt: u.lastLoginAt,
        roles: u.roles.map((r) => ({ id: r.role.id, code: r.role.code, name: r.role.name })),
      })),
    };
  }

  async create(actorId: string, input: CreateUserInput, meta: RequestMeta) {
    const email = input.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new BadRequestException({ code: "EMAIL_EXISTS", message: "อีเมลนี้มีในระบบแล้ว" });
    }
    const pwParse = passwordSchema.safeParse(input.password);
    const pwError = pwParse.success ? checkPasswordNotEmail(input.password, email) : pwParse.error.issues[0]?.message;
    if (pwError) throw new BadRequestException({ code: "WEAK_PASSWORD", message: pwError });

    const phone = input.phone ? normalizePhone(input.phone) : null;
    if (input.phone && !phone) {
      throw new BadRequestException({ code: "INVALID_PHONE", message: "รูปแบบเบอร์โทรไม่ถูกต้อง" });
    }

    const created = await this.prisma.user.create({
      data: {
        email,
        fullName: input.fullName.trim(),
        passwordHash: await hashPassword(input.password),
        nickname: input.nickname?.trim() || null,
        phone,
        teamId: input.teamId ?? null,
        isFreelance: input.isFreelance ?? false,
        createdById: actorId,
        roles: { create: input.roleIds.map((roleId) => ({ roleId })) },
      },
      include: { roles: { include: { role: true } } },
    });

    await this.audit.log({
      actorId,
      action: "CREATE",
      entityType: "user",
      entityId: created.id,
      after: {
        email: created.email,
        fullName: created.fullName,
        teamId: created.teamId,
        roles: created.roles.map((r) => r.role.code),
      },
      meta,
    });

    return { id: created.id, email: created.email, fullName: created.fullName };
  }

  async update(actorId: string, id: string, input: UpdateUserInput, meta: RequestMeta) {
    const before = await this.prisma.user.findUnique({
      where: { id },
      include: { roles: { include: { role: true } } },
    });
    if (!before || before.archivedAt) {
      throw new NotFoundException({ code: "USER_NOT_FOUND", message: "ไม่พบผู้ใช้นี้" });
    }

    const phone = input.phone !== undefined ? (input.phone ? normalizePhone(input.phone) : null) : before.phone;
    if (input.phone && !phone) {
      throw new BadRequestException({ code: "INVALID_PHONE", message: "รูปแบบเบอร์โทรไม่ถูกต้อง" });
    }

    await this.prisma.$transaction(async (tx) => {
      if (input.roleIds) {
        await tx.userRole.deleteMany({ where: { userId: id } });
        await tx.userRole.createMany({ data: input.roleIds.map((roleId) => ({ userId: id, roleId })) });
      }
      await tx.user.update({
        where: { id },
        data: {
          fullName: input.fullName?.trim() ?? before.fullName,
          nickname: input.nickname !== undefined ? input.nickname?.trim() || null : before.nickname,
          phone,
          teamId: input.teamId !== undefined ? input.teamId : before.teamId,
          isActive: input.isActive ?? before.isActive,
          isFreelance: input.isFreelance ?? before.isFreelance,
          updatedById: actorId,
        },
      });
    });

    if (input.isActive === false) {
      await this.sessions.revokeAllForUser(id);
    }
    this.cache.invalidate(id);

    await this.audit.log({
      actorId,
      action: "UPDATE",
      entityType: "user",
      entityId: id,
      before: {
        fullName: before.fullName,
        teamId: before.teamId,
        isActive: before.isActive,
        roles: before.roles.map((r) => r.role.code),
      },
      after: input,
      meta,
    });

    return { ok: true };
  }

  async resetMfa(actorId: string, id: string, meta: RequestMeta) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user || user.archivedAt) {
      throw new NotFoundException({ code: "USER_NOT_FOUND", message: "ไม่พบผู้ใช้นี้" });
    }
    await this.prisma.user.update({
      where: { id },
      data: { totpEnabled: false, totpSecret: null, updatedById: actorId },
    });
    await this.sessions.revokeAllForUser(id);
    this.cache.invalidate(id);

    await this.audit.log({
      actorId,
      action: "UPDATE",
      entityType: "user",
      entityId: id,
      before: { totpEnabled: user.totpEnabled },
      after: { totpEnabled: false, mfaResetByAdmin: true },
      meta,
    });

    return { ok: true, totpEnabled: false };
  }
}
