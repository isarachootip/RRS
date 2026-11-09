import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import type { AuthUser } from "../auth/auth.types";
import { CurrentUser, Public } from "../auth/public.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { ChatService } from "./chat.service";
import { PublicChatService } from "./public-chat.service";

const ListRoomsQuery = z.object({
  type: z.enum(["CUSTOMER", "OWNER"]).optional(),
});

const CreateOwnerRoomBody = z.object({
  ownerId: z.string().uuid(),
  assetCode: z.string().trim().max(40).nullish(),
});

const CreateCustomerRoomBody = z.object({
  title: z.string().trim().min(1).max(120),
  subtitle: z.string().trim().max(200).nullish(),
  assetCode: z.string().trim().max(40).nullish(),
  lineUserId: z.string().trim().max(80).nullish(),
});

const SendMessageBody = z.object({
  content: z.string().trim().min(1, "กรุณาพิมพ์ข้อความ").max(4000),
  imageUrl: z.string().trim().max(2000).nullish(),
  assetCode: z.string().trim().max(40).nullish(),
  senderName: z.string().trim().max(120).optional(),
});

const UpdateRoomBody = z.object({
  lineUserId: z.string().trim().max(80).nullish(),
  assetCode: z.string().trim().max(40).nullish(),
});

@ApiTags("chat")
@Controller()
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly publicChat: PublicChatService,
  ) {}

  @ApiBearerAuth()
  @Get("chat/rooms")
  @ApiOperation({ summary: "รายการห้องแชทลูกค้าและเจ้าของทรัพย์สิน" })
  listRooms(@CurrentUser() user: AuthUser, @Query(new ZodPipe(ListRoomsQuery)) query: z.infer<typeof ListRoomsQuery>) {
    return this.chat.listRooms(user, query.type);
  }

  @ApiBearerAuth()
  @Get("chat/rooms/:id")
  @ApiOperation({ summary: "ดึงข้อความในห้องแชทและเคลียร์จำนวนที่ยังไม่อ่าน" })
  getRoom(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.chat.getRoomDetail(user, id);
  }

  @ApiBearerAuth()
  @Post("chat/rooms/owner")
  @HttpCode(200)
  @ApiOperation({ summary: "สร้างหรือเปิดห้องแชทคุยกับเจ้าของทรัพย์สิน (Owner Internal Chat)" })
  createOrGetOwnerRoom(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(CreateOwnerRoomBody)) body: z.infer<typeof CreateOwnerRoomBody>,
  ) {
    return this.chat.createOrGetOwnerRoom(user, body.ownerId, body.assetCode);
  }

  @ApiBearerAuth()
  @Post("chat/rooms/customer")
  @HttpCode(200)
  @ApiOperation({ summary: "สร้างห้องแชทลูกค้าใหม่" })
  createCustomerRoom(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(CreateCustomerRoomBody)) body: z.infer<typeof CreateCustomerRoomBody>,
  ) {
    return this.chat.createCustomerRoom(user, body);
  }

  @ApiBearerAuth()
  @Patch("chat/rooms/:id")
  @ApiOperation({ summary: "ผูก LINE User ID หรือรหัสทรัพย์สินกับห้องแชท" })
  updateRoom(@Param("id") id: string, @Body(new ZodPipe(UpdateRoomBody)) body: z.infer<typeof UpdateRoomBody>) {
    return this.chat.updateRoomMeta(id, body);
  }

  @ApiBearerAuth()
  @Post("chat/rooms/:id/messages")
  @HttpCode(200)
  @ApiOperation({ summary: "ส่งข้อความตอบกลับลูกค้าหรือเจ้าของทรัพย์ (พร้อมส่งเข้า LINE OA อัตโนมัติหากผูกไว้)" })
  sendStaffMessage(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodPipe(SendMessageBody)) body: z.infer<typeof SendMessageBody>,
  ) {
    return this.chat.sendStaffMessage(user, id, body);
  }

  @Public()
  @Get("public/chat/:token")
  @ApiOperation({ summary: "ดึงห้องแชทส่วนตัวผ่านลิงก์เว็บสำหรับเจ้าของทรัพย์หรือลูกค้า" })
  getPublicRoom(@Param("token") token: string) {
    return this.publicChat.getPublicRoom(token);
  }

  @Public()
  @Post("public/chat/:token/messages")
  @HttpCode(200)
  @ApiOperation({ summary: "เจ้าของทรัพย์หรือลูกค้าส่งข้อความผ่านลิงก์ห้องแชทเว็บ" })
  sendPublicMessage(@Param("token") token: string, @Body(new ZodPipe(SendMessageBody)) body: z.infer<typeof SendMessageBody>) {
    return this.publicChat.sendPublicMessage(token, body);
  }
}
