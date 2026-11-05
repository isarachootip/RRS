import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Sse } from "@nestjs/common";
import type { AuthUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/public.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { Can } from "../rbac/can.decorator";
import { NotificationsService } from "./notifications.service";
import {
  LinkLineSchema,
  ListNotificationsQuerySchema,
  RunScheduledJobsSchema,
  UpdateNotificationPrefsSchema,
  UpdateNotificationRuleSchema,
  type LinkLineDto,
  type ListNotificationsQueryDto,
  type RunScheduledJobsDto,
  type UpdateNotificationPrefsDto,
  type UpdateNotificationRuleDto,
} from "./notifications.types";

@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query(new ZodPipe(ListNotificationsQuerySchema)) query: ListNotificationsQueryDto,
  ) {
    return this.notificationsService.listForUser(user.id, query);
  }

  @Sse("stream")
  stream(@CurrentUser() user: AuthUser) {
    return this.notificationsService.streamForUser(user.id);
  }

  @Patch(":id/read")
  markRead(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.notificationsService.markRead(user.id, id);
  }

  @Post("read-all")
  markAllRead(@CurrentUser() user: AuthUser) {
    return this.notificationsService.markAllRead(user.id);
  }

  @Get("preferences")
  getPreferences(@CurrentUser() user: AuthUser) {
    return this.notificationsService.getPreferences(user.id);
  }

  @Patch("preferences")
  updatePreferences(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(UpdateNotificationPrefsSchema)) dto: UpdateNotificationPrefsDto,
  ) {
    return this.notificationsService.updatePreferences(user.id, dto);
  }

  @Post("line/link")
  linkLine(@CurrentUser() user: AuthUser, @Body(new ZodPipe(LinkLineSchema)) dto: LinkLineDto) {
    return this.notificationsService.linkLine(user.id, dto);
  }

  @Delete("line/link")
  unlinkLine(@CurrentUser() user: AuthUser) {
    return this.notificationsService.unlinkLine(user.id);
  }

  @Get("rules")
  @Can("notification_rule.manage")
  listRules() {
    return this.notificationsService.listRules();
  }

  @Patch("rules/:event")
  @Can("notification_rule.manage")
  updateRule(
    @CurrentUser() user: AuthUser,
    @Param("event") event: string,
    @Body(new ZodPipe(UpdateNotificationRuleSchema)) dto: UpdateNotificationRuleDto,
  ) {
    return this.notificationsService.updateRule(user.id, event, dto);
  }

  @Post("jobs/run")
  @Can("notification_rule.manage")
  runJobs(@Body(new ZodPipe(RunScheduledJobsSchema)) dto: RunScheduledJobsDto) {
    const now = dto.now ? new Date(dto.now) : new Date();
    return this.notificationsService.runScheduledChecks(now);
  }
}
