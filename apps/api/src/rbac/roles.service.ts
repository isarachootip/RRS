import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PERMISSIONS, type PermissionCode, type Scope } from "@rrs/shared";
import { AuditService } from "../audit/audit.service";
import type { RequestMeta } from "../common/request-meta";
import { PrismaService } from "../prisma/prisma.service";
import { PermissionCacheService } from "./permission-cache.service";

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly cache: PermissionCacheService,
  ) {}

  async list() {
    const roles = await this.prisma.role.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
    });
    const catalog = Object.entries(PERMISSIONS).map(([code, description]) => ({
      code,
      module: code.split(".")[0] ?? code,
      description,
    }));

    return {
      roles: roles.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        description: r.description,
        isSystem: r.isSystem,
        userCount: r._count.users,
        permissions: r.permissions.map((rp) => ({
          code: rp.permission.code as PermissionCode,
          scope: rp.scope as Scope,
        })),
      })),
      catalog,
    };
  }

  async create(actorId: string, input: { code: string; name: string; description?: string | null }, meta: RequestMeta) {
    const code = input.code.trim().toUpperCase();
    const exists = await this.prisma.role.findUnique({ where: { code } });
    if (exists) {
      throw new BadRequestException({ code: "ROLE_EXISTS", message: "รหัสบทบาทนี้มีอยู่แล้ว" });
    }
    const created = await this.prisma.role.create({
      data: {
        code,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        isSystem: false,
      },
    });
    await this.audit.log({
      actorId,
      action: "CREATE",
      entityType: "role",
      entityId: created.id,
      after: { code: created.code, name: created.name },
      meta,
    });
    return created;
  }

  async updatePermissions(
    actorId: string,
    roleId: string,
    items: Array<{ code: PermissionCode; scope: Scope }>,
    meta: RequestMeta,
  ) {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      include: { permissions: { include: { permission: true } } },
    });
    if (!role) {
      throw new NotFoundException({ code: "ROLE_NOT_FOUND", message: "ไม่พบบทบาทนี้" });
    }

    const before = role.permissions.map((rp) => ({ code: rp.permission.code, scope: rp.scope }));

    const permMap = new Map<string, string>();
    for (const item of items) {
      const description = PERMISSIONS[item.code];
      const p = await this.prisma.permission.upsert({
        where: { code: item.code },
        update: { description },
        create: { code: item.code, description, module: item.code.split(".")[0] ?? item.code },
      });
      permMap.set(item.code, p.id);
    }

    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId } }),
      this.prisma.rolePermission.createMany({
        data: items.map((item) => ({
          roleId,
          permissionId: permMap.get(item.code)!,
          scope: item.scope,
        })),
      }),
    ]);

    this.cache.invalidate();

    await this.audit.log({
      actorId,
      action: "UPDATE",
      entityType: "role",
      entityId: roleId,
      before: { permissions: before },
      after: { permissions: items },
      meta,
    });

    return { ok: true, permissions: items };
  }
}
