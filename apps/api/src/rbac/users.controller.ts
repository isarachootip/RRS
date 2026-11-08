import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { z } from "zod";
import type { AuthUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/public.decorator";
import { requestMeta } from "../common/request-meta";
import { ZodPipe } from "../common/zod.pipe";
import { Can } from "./can.decorator";
import { UsersService } from "./users.service";

const emailOrUsername = z
  .string()
  .trim()
  .min(1, "กรุณาระบุชื่อผู้ใช้หรืออีเมล")
  .max(254)
  .transform((v) => (v.includes("@") ? v.toLowerCase() : `${v.toLowerCase()}@rrs.local`))
  .refine((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "รูปแบบอีเมลหรือชื่อผู้ใช้ไม่ถูกต้อง");

const CreateUserBody = z.object({
  email: emailOrUsername,
  fullName: z.string().trim().min(1, "กรุณาระบุชื่อ-นามสกุล").max(120),
  password: z.string().min(6, "รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร").max(128),
  nickname: z.string().trim().max(60).nullish(),
  phone: z.string().trim().max(30).nullish(),
  teamId: z.string().uuid().nullish(),
  isFreelance: z.boolean().optional(),
  roleIds: z.array(z.string().uuid()).min(1, "กรุณาเลือกอย่างน้อย 1 บทบาท"),
});

const UpdateUserBody = z.object({
  email: emailOrUsername.optional(),
  fullName: z.string().trim().min(1).max(120).optional(),
  password: z.string().min(6, "รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร").max(128).optional(),
  nickname: z.string().trim().max(60).nullish(),
  phone: z.string().trim().max(30).nullish(),
  teamId: z.string().uuid().nullish(),
  isActive: z.boolean().optional(),
  isFreelance: z.boolean().optional(),
  roleIds: z.array(z.string().uuid()).min(1).optional(),
});

@ApiTags("users")
@ApiBearerAuth()
@Can("user.manage")
@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOperation({ summary: "รายการผู้ใช้ทั้งหมด (เฉพาะ Admin)" })
  list() {
    return this.users.list();
  }

  @Post()
  @ApiOperation({ summary: "สร้างผู้ใช้ใหม่ (เฉพาะ Admin)" })
  create(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodPipe(CreateUserBody)) body: z.infer<typeof CreateUserBody>,
    @Req() req: Request,
  ) {
    return this.users.create(actor.id, body, requestMeta(req));
  }

  @Patch(":id")
  @ApiOperation({ summary: "แก้ไขข้อมูลผู้ใช้ รหัสผ่าน บทบาท ทีม หรือเปิด/ปิดบัญชี (เฉพาะ Admin)" })
  update(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Body(new ZodPipe(UpdateUserBody)) body: z.infer<typeof UpdateUserBody>,
    @Req() req: Request,
  ) {
    return this.users.update(actor.id, id, body, requestMeta(req));
  }

  @Delete(":id")
  @HttpCode(200)
  @ApiOperation({ summary: "ลบ/ระงับผู้ใช้ถาวร (เฉพาะ Admin)" })
  remove(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Req() req: Request) {
    return this.users.remove(actor.id, id, requestMeta(req));
  }

  @Post(":id/reset-mfa")
  @HttpCode(200)
  @ApiOperation({ summary: "รีเซ็ต 2FA ของผู้ใช้อื่นและบันทึก audit (เฉพาะ Admin)" })
  resetMfa(@CurrentUser() actor: AuthUser, @Param("id") id: string, @Req() req: Request) {
    return this.users.resetMfa(actor.id, id, requestMeta(req));
  }
}
