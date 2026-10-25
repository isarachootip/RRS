import { type CanActivate, type ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { PermissionCode } from "@rrs/shared";
import type { Request } from "express";
import type { AuthUser } from "../auth/auth.types";
import { IS_PUBLIC } from "../auth/public.decorator";
import { REQUIRED_PERMISSIONS } from "./can.decorator";
import { PermissionCacheService } from "./permission-cache.service";

/**
 * Guard ตรวจสิทธิ์ตามบทบาท ทำงานต่อจาก JwtAuthGuard
 * แนบ permissions และ teamId ล่าสุดใน req.user และตรวจ @Can(...)
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly cache: PermissionCacheService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    if (!req.user) return false;

    const access = await this.cache.getAccess(req.user.id);
    req.user.teamId = access.teamId;
    req.user.roles = access.roles;
    req.user.permissions = access.permissions;

    const required = this.reflector.getAllAndOverride<PermissionCode[] | undefined>(REQUIRED_PERMISSIONS, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const allowed = required.some((perm) => Boolean(access.permissions[perm]));
    if (!allowed) {
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "คุณไม่มีสิทธิ์ทำรายการนี้",
      });
    }
    return true;
  }
}
