import { type CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import { setAuditActor } from "../audit/request-context";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthUser } from "./auth.types";
import { IS_PUBLIC } from "./public.decorator";

interface AccessPayload {
  sub: string;
  email: string;
  roles: string[];
}

/** guard ทั้งระบบ: ทุก endpoint ต้องมี access token ยกเว้นที่ติด @Public() */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const [type, token] = req.headers.authorization?.split(" ") ?? [];
    if (type !== "Bearer" || !token) throw unauthorized();

    let payload: AccessPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessPayload>(token, { audience: "access" });
    } catch {
      throw unauthorized();
    }
    // ผู้ใช้ที่ถูกปิดหรือ archive จะหมดสิทธิ์ทันที ไม่ต้องรอ token หมดอายุ
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { isActive: true, archivedAt: true },
    });
    if (!user || !user.isActive || user.archivedAt) throw unauthorized();

    req.user = { id: payload.sub, email: payload.email, roles: payload.roles };
    setAuditActor(payload.sub);
    return true;
  }
}

const unauthorized = () => new UnauthorizedException({ code: "UNAUTHENTICATED", message: "กรุณาเข้าสู่ระบบ" });
