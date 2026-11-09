import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { ChatController } from "./chat.controller";
import { ChatService } from "./chat.service";
import { PublicChatService } from "./public-chat.service";

@Module({
  imports: [NotificationsModule],
  controllers: [ChatController],
  providers: [ChatService, PublicChatService],
  exports: [ChatService, PublicChatService],
})
export class ChatModule {}
