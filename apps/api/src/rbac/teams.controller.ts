import { Body, Controller, Get, Param, Patch, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { z } from "zod";
import type { AuthUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/public.decorator";
import { requestMeta } from "../common/request-meta";
import { ZodPipe } from "../common/zod.pipe";
import { Can } from "./can.decorator";
import { TeamsService } from "./teams.service";

const CreateTeamBody = z.object({
  name: z.string().trim().min(1, "กรุณาระบุชื่อทีม").max(80),
  managerId: z.string().uuid().nullish(),
});

const UpdateTeamBody = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  managerId: z.string().uuid().nullish(),
});

@ApiTags("teams")
@ApiBearerAuth()
@Controller("teams")
export class TeamsController {
  constructor(private readonly teams: TeamsService) {}

  @Can("team.read", "user.manage")
  @Get()
  @ApiOperation({ summary: "ดูข้อมูลทีม (Admin เห็นทั้งหมด, Manager เห็นทีมตัวเอง)" })
  list(@CurrentUser() user: AuthUser) {
    return this.teams.list(user);
  }

  @Can("user.manage")
  @Post()
  @ApiOperation({ summary: "สร้างทีมใหม่ (เฉพาะ Admin)" })
  create(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodPipe(CreateTeamBody)) body: z.infer<typeof CreateTeamBody>,
    @Req() req: Request,
  ) {
    return this.teams.create(actor.id, body, requestMeta(req));
  }

  @Can("user.manage")
  @Patch(":id")
  @ApiOperation({ summary: "แก้ไขชื่อทีมหรือหัวหน้าทีม (เฉพาะ Admin)" })
  update(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Body(new ZodPipe(UpdateTeamBody)) body: z.infer<typeof UpdateTeamBody>,
    @Req() req: Request,
  ) {
    return this.teams.update(actor.id, id, body, requestMeta(req));
  }
}
