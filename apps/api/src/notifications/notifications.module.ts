import { Global, Module } from "@nestjs/common";
import { MailModule } from "../mail/mail.module";
import { LineMessagingService } from "./line-messaging.service";
import { NotificationsDispatcherService } from "./notifications-dispatcher.service";
import { NotificationsSchedulerService } from "./notifications-scheduler.service";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";

@Global()
@Module({
  imports: [MailModule],
  controllers: [NotificationsController],
  providers: [
    LineMessagingService,
    NotificationsDispatcherService,
    NotificationsSchedulerService,
    NotificationsService,
  ],
  exports: [LineMessagingService, NotificationsDispatcherService, NotificationsSchedulerService, NotificationsService],
})
export class NotificationsModule {}
