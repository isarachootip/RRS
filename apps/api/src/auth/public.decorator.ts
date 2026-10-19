import { SetMetadata, createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { AuthUser } from "./auth.types";

export const IS_PUBLIC = "isPublic";
/** endpoint ที่ไม่ต้องล็อกอิน */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** ผู้ใช้ปัจจุบัน (มีเสมอใน endpoint ที่ไม่ใช่ @Public) */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest<{ user: AuthUser }>().user;
});
