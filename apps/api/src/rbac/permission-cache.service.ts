import { Injectable } from "@nestjs/common";
import type { Scope } from "@rrs/shared";
import { PrismaService } from "../prisma/prisma.service";

const SCOPE_RANK: Record<Scope, number> = { OWN: 1, TEAM: 2, ALL: 3 };
const CACHE_TTL_MS = 60_000;

export interface CachedUserAccess {
  teamId: string | null;
  roles: string[];
  permissions: Record<string, Scope>;
  expiresAt: number;
}

/**
 * โหลดและแคชสิทธิ์ของผู้ใช้จากฐานข้อมูล (TTL สูงสุด 60 วินาทีตามสเปก P04)
 * เมื่อ Admin แก้บทบาทหรือสิทธิ์ จะเรียก invalidate() เพื่อให้มีผลทันที
 */
@Injectable()
export class PermissionCacheService {
  private readonly cache = new Map<string, CachedUserAccess>();

  constructor(private readonly prisma: PrismaService) {}

  async getAccess(userId: string): Promise<CachedUserAccess> {
    const now = Date.now();
    const cached = this.cache.get(userId);
    if (cached && cached.expiresAt > now) return cached;

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        teamId: true,
        roles: {
          include: {
            role: {
              include: {
                permissions: { include: { permission: true } },
              },
            },
          },
        },
      },
    });

    const permissions: Record<string, Scope> = {};
    const roles: string[] = [];
    for (const ur of user.roles) {
      roles.push(ur.role.code);
      for (const rp of ur.role.permissions) {
        const prev = permissions[rp.permission.code];
        if (!prev || SCOPE_RANK[rp.scope] > SCOPE_RANK[prev]) {
          permissions[rp.permission.code] = rp.scope;
        }
      }
    }

    const entry: CachedUserAccess = {
      teamId: user.teamId,
      roles,
      permissions,
      expiresAt: now + CACHE_TTL_MS,
    };
    this.cache.set(userId, entry);
    return entry;
  }

  invalidate(userId?: string) {
    if (userId) this.cache.delete(userId);
    else this.cache.clear();
  }
}
