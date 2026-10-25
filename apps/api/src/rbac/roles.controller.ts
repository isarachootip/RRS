import { Body, Controller, Get, Param, Post, Put, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { PERMISSIONS, type PermissionCode } from "@rrs/shared";
import type { Request } from "express";
import { z } from "zod";
import type { AuthUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/public.decorator";
import { requestMeta } from "../common/request-meta";
import { ZodPipe } from "../common/zod.pipe";
import { Can } from "./can.decorator";
import { RolesService } from "./roles.service";

const permissionCodes = Object.keys(PERMISSIONS) as [PermissionCode, ...PermissionCode[]];

const CreateRoleBody = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[A-Z0-9_]{2,32}$/, "รหัสบทบาทต้องเป็นตัวพิมพ์ใหญ่ A-Z, 0-9 หรือ _"),
  name: z.string().trim().min(1, "กรุณาระบุชื่อบทบาท").max(80),
  description: z.string().trim().max(240).nullish(),
});

const UpdatePermissionsBody = z.object({
  permissions: z.array(
    z.object({
      code: z.enum(permissionCodes),
      scope: z.enum(["ALL", "TEAM", "OWN"]),
    }),
  ),
});

@ApiTags("roles")
@ApiBearerAuth()
@Can("role.manage")
@Controller("roles")
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  @ApiOperation({ summary: "ดูบทบาททั้งหมดและแคตตาล็อกสิทธิ์ (เฉพาะ Admin)" })
  list() {
    return this.roles.list();
  }

  @Post()
  @ApiOperation({ summary: "สร้างบทบาทใหม่ (เฉพาะ Admin)" })
  create(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodPipe(CreateRoleBody)) body: z.infer<typeof CreateRoleBody>,
    @Req() req: Request,
  ) {
    return this.roles.create(actor.id, body, requestMeta(req));
  }

  @Put(":id/permissions")
  @ApiOperation({ summary: "บันทึกตารางสิทธิ์และ scope ของบทบาท (เฉพาะ Admin)" })
  updatePermissions(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Body(new ZodPipe(UpdatePermissionsBody)) body: z.infer<typeof UpdatePermissionsBody>,
    @Req() req: Request,
  ) {
    return this.roles.updatePermissions(actor.id, id, body.permissions, requestMeta(req));
  }
}
