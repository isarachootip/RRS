import { Body, Controller, Get, HttpCode, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import type { AuthUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/public.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { TeamChatService } from "./team-chat.service";

const AttachmentSchema = z.object({
  name: z.string().trim().min(1).max(255),
  url: z.string().trim().min(1).max(2000),
  mimeType: z.string().trim().min(1).max(120),
});

const CreateTeamChannelBody = z.object({
  name: z.string().trim().min(1, "กรุณาระบุชื่อห้องแชท").max(80),
  description: z.string().trim().max(200).nullish(),
  memberIds: z.array(z.string().uuid()).max(200).optional(),
});

const SendTeamChatMessageBody = z
  .object({
    content: z.string().max(4000).default(""),
    attachments: z.array(AttachmentSchema).max(5).optional(),
    mentionedUserIds: z.array(z.string().uuid()).max(50).optional(),
  })
  .refine(
    (data) => data.content.trim().length > 0 || (data.attachments && data.attachments.length > 0),
    { message: "กรุณาพิมพ์ข้อความหรือแนบไฟล์" },
  );

@ApiTags("team-chat")
@ApiBearerAuth()
@Controller("team-chat")
export class TeamChatController {
  constructor(private readonly teamChat: TeamChatService) {}

  @Get("channels")
  @ApiOperation({ summary: "รายการห้องแชทภายในทีม (#Channel) และรายชื่อสมาชิกสำหรับ @mention" })
  listChannels(@CurrentUser() user: AuthUser) {
    return this.teamChat.listChannels(user);
  }

  @Post("channels")
  @HttpCode(200)
  @ApiOperation({ summary: "สร้างห้องแชทภายในทีม (#Channel) ใหม่พร้อมเลือกสมาชิก" })
  createChannel(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(CreateTeamChannelBody)) body: z.infer<typeof CreateTeamChannelBody>,
  ) {
    return this.teamChat.createChannel(user, body);
  }

  @Get("channels/:id/messages")
  @ApiOperation({ summary: "ดึงข้อความในห้องแชททีมและทำเครื่องหมายว่าอ่านแล้ว" })
  getMessages(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.teamChat.getMessages(user, id);
  }

  @Post("channels/:id/messages")
  @HttpCode(200)
  @ApiOperation({ summary: "ส่งข้อความในห้องแชททีม รองรับ @mention และแนบไฟล์/รูปภาพ" })
  sendMessage(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodPipe(SendTeamChatMessageBody)) body: z.infer<typeof SendTeamChatMessageBody>,
  ) {
    return this.teamChat.sendMessage(user, id, body);
  }
}
