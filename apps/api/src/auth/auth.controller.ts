import { Body, Controller, Get, HttpCode, Post, Req, Res } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { CookieOptions, Request, Response } from "express";
import { z } from "zod";
import { AuditService } from "../audit/audit.service";
import type { Env } from "../config/env";
import { requestMeta } from "../common/request-meta";
import { ZodPipe } from "../common/zod.pipe";
import { AuthService, type LoginOutcome } from "./auth.service";
import type { AuthUser } from "./auth.types";
import { CurrentUser, Public } from "./public.decorator";
import { SessionService } from "./session.service";

export const REFRESH_COOKIE = "rrs_refresh";
const COOKIE_PATH = "/api/v1/auth";

const email = z.string().trim().email("รูปแบบอีเมลไม่ถูกต้อง").max(254);
const code = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "รหัสยืนยันต้องเป็นตัวเลข 6 หลัก");
const LoginBody = z.object({ email, password: z.string().min(1, "กรุณาใส่รหัสผ่าน").max(128) });
const ChallengeBody = z.object({ challengeToken: z.string().min(1) });
const ChallengeCodeBody = ChallengeBody.extend({ code });
const CodeBody = z.object({ code });
const ForgotBody = z.object({ email });
const ResetBody = z.object({ token: z.string().min(10), password: z.string() });
const ChangeBody = z.object({ currentPassword: z.string().min(1), newPassword: z.string() });

/** ปรับจำนวนครั้งต่อนาทีของ endpoint ล็อกอินได้จาก .env (AUTH_RATE_LIMIT_PER_MINUTE) */
const authLimit = () => ({ default: { limit: Number(process.env.AUTH_RATE_LIMIT_PER_MINUTE ?? 10), ttl: 60_000 } });

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Public()
  @Throttle(authLimit())
  @Post("login")
  @HttpCode(200)
  @ApiOperation({ summary: "เข้าสู่ระบบด้วยอีเมลและรหัสผ่าน" })
  async login(
    @Body(new ZodPipe(LoginBody)) body: z.infer<typeof LoginBody>,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.respond(await this.auth.login(body.email, body.password, requestMeta(req)), res);
  }

  @Public()
  @Throttle(authLimit())
  @Post("mfa/verify")
  @HttpCode(200)
  @ApiOperation({ summary: "ยืนยันรหัส 6 หลักจากแอป Authenticator หลังล็อกอิน" })
  async mfaVerify(
    @Body(new ZodPipe(ChallengeCodeBody)) body: z.infer<typeof ChallengeCodeBody>,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const userId = await this.sessions.verifyChallenge(body.challengeToken);
    return this.respond(await this.auth.mfaVerify(userId, body.code, requestMeta(req)), res);
  }

  @Public()
  @Throttle(authLimit())
  @Post("mfa/setup")
  @HttpCode(200)
  @ApiOperation({ summary: "เริ่มตั้งค่า 2FA ระหว่างล็อกอิน (บทบาทที่บังคับใช้)" })
  async mfaSetupDuringLogin(@Body(new ZodPipe(ChallengeBody)) body: z.infer<typeof ChallengeBody>) {
    return this.auth.mfaSetup(await this.sessions.verifyChallenge(body.challengeToken));
  }

  @Public()
  @Throttle(authLimit())
  @Post("mfa/enable")
  @HttpCode(200)
  @ApiOperation({ summary: "ยืนยันรหัสแรกเพื่อเปิด 2FA แล้วเข้าสู่ระบบ" })
  async mfaEnableDuringLogin(
    @Body(new ZodPipe(ChallengeCodeBody)) body: z.infer<typeof ChallengeCodeBody>,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const userId = await this.sessions.verifyChallenge(body.challengeToken);
    const outcome = await this.auth.mfaEnable(userId, body.code, requestMeta(req), true);
    return this.respond(outcome as LoginOutcome, res);
  }

  @ApiBearerAuth()
  @Post("me/mfa/setup")
  @HttpCode(200)
  @ApiOperation({ summary: "เปิด 2FA เองจากหน้าโปรไฟล์ (ขั้นที่ 1)" })
  mfaSetup(@CurrentUser() user: AuthUser) {
    return this.auth.mfaSetup(user.id);
  }

  @ApiBearerAuth()
  @Post("me/mfa/enable")
  @HttpCode(200)
  @ApiOperation({ summary: "เปิด 2FA เองจากหน้าโปรไฟล์ (ขั้นที่ 2)" })
  async mfaEnable(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(CodeBody)) body: z.infer<typeof CodeBody>,
    @Req() req: Request,
  ) {
    await this.auth.mfaEnable(user.id, body.code, requestMeta(req), false);
    return { totpEnabled: true };
  }

  @Public()
  @Post("refresh")
  @HttpCode(200)
  @ApiOperation({ summary: "ขอ access token ใหม่ด้วย refresh cookie (หมุน cookie ทุกครั้ง)" })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    try {
      const s = await this.sessions.rotate(req.cookies?.[REFRESH_COOKIE], requestMeta(req));
      this.setCookie(res, s.refreshToken, s.refreshExpiresAt);
      return { accessToken: s.accessToken, expiresIn: s.expiresIn, user: await this.auth.me(s.userId) };
    } catch (e) {
      this.clearCookie(res);
      throw e;
    }
  }

  @Public()
  @Post("logout")
  @HttpCode(200)
  @ApiOperation({ summary: "ออกจากระบบ (เครื่องนี้)" })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const t = await this.sessions.revokeByToken(req.cookies?.[REFRESH_COOKIE]);
    if (t) await this.auditLogout(t.userId, "this_device", req);
    this.clearCookie(res);
    return { ok: true };
  }

  @ApiBearerAuth()
  @Post("logout-all")
  @HttpCode(200)
  @ApiOperation({ summary: "ออกจากระบบทุกอุปกรณ์" })
  async logoutAll(@CurrentUser() user: AuthUser, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.sessions.revokeAllForUser(user.id);
    await this.auditLogout(user.id, "all_devices", req);
    this.clearCookie(res);
    return { ok: true };
  }

  @Public()
  @Throttle(authLimit())
  @Post("password/forgot")
  @HttpCode(200)
  @ApiOperation({ summary: "ขอลิงก์ตั้งรหัสผ่านใหม่ทางอีเมล" })
  async forgot(@Body(new ZodPipe(ForgotBody)) body: z.infer<typeof ForgotBody>, @Req() req: Request) {
    await this.auth.forgotPassword(body.email, requestMeta(req));
    return { message: "ถ้ามีบัญชีนี้ในระบบ เราได้ส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่อีเมลแล้ว ลิงก์ใช้ได้ 30 นาที" };
  }

  @Public()
  @Throttle(authLimit())
  @Post("password/reset")
  @HttpCode(200)
  @ApiOperation({ summary: "ตั้งรหัสผ่านใหม่จากลิงก์ในอีเมล" })
  async reset(@Body(new ZodPipe(ResetBody)) body: z.infer<typeof ResetBody>, @Req() req: Request) {
    await this.auth.resetPassword(body.token, body.password, requestMeta(req));
    return { message: "ตั้งรหัสผ่านใหม่แล้ว เข้าสู่ระบบด้วยรหัสผ่านใหม่ได้เลย" };
  }

  @ApiBearerAuth()
  @Post("password/change")
  @HttpCode(200)
  @ApiOperation({ summary: "เปลี่ยนรหัสผ่าน (ออกจากระบบทุกอุปกรณ์)" })
  async change(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(ChangeBody)) body: z.infer<typeof ChangeBody>,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.changePassword(user.id, body.currentPassword, body.newPassword, requestMeta(req));
    this.clearCookie(res);
    return { message: "เปลี่ยนรหัสผ่านแล้ว กรุณาเข้าสู่ระบบใหม่" };
  }

  @ApiBearerAuth()
  @Get("me")
  @ApiOperation({ summary: "ข้อมูลผู้ใช้ปัจจุบัน บทบาท และสิทธิ์" })
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  // ---------------- helpers ----------------

  private respond(outcome: LoginOutcome, res: Response) {
    if (outcome.session) this.setCookie(res, outcome.session.refreshToken, outcome.session.refreshExpiresAt);
    return outcome.result;
  }

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.get("COOKIE_SECURE"),
      sameSite: "lax",
      path: COOKIE_PATH,
      domain: this.config.get("COOKIE_DOMAIN") || undefined,
    };
  }

  private setCookie(res: Response, token: string, expires: Date) {
    res.cookie(REFRESH_COOKIE, token, { ...this.cookieOptions(), expires });
  }

  private clearCookie(res: Response) {
    res.clearCookie(REFRESH_COOKIE, this.cookieOptions());
  }

  private auditLogout(userId: string, scope: string, req: Request) {
    return this.audit.log({
      actorId: userId,
      action: "LOGOUT",
      entityType: "user",
      entityId: userId,
      after: { scope },
      meta: requestMeta(req),
    });
  }
}
