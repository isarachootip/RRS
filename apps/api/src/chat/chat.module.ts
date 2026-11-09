import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { ChatController } from "./chat.controller";
import { ChatService } from "./chat.service";
import { PublicChatService } from "./public-chat.service";
import { TeamChatController } from "./team-chat.controller";
import { TeamChatService } from "./team-chat.service";

@Module({
  imports: [NotificationsModule],
  controllers: [ChatController, TeamChatController],
  providers: [ChatService, PublicChatService, TeamChatService],
  exports: [ChatService, PublicChatService, TeamChatService],
})
export class ChatModule {}
