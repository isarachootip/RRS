import type { Prisma } from "@rrs/db";
import type { PrismaService } from "../prisma/prisma.service";
import {
  DEFAULT_NOTIFICATION_RULES,
  type NotificationChannelType,
  type NotificationEventContext,
  type ResolvedRecipientUser,
} from "./notifications.types";

export async function ensureDefaultNotificationRules(prisma: PrismaService) {
  const count = await prisma.notificationRule.count();
  if (count > 0) return;
  for (const r of DEFAULT_NOTIFICATION_RULES) {
    await prisma.notificationRule.upsert({
      where: { event: r.event },
      update: {},
      create: {
        event: r.event,
        description: r.description,
        recipients: r.recipients,
        timing: (r.timing ?? {}) as Prisma.InputJsonValue,
        channels: r.channels,
      },
    });
  }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function resolveRecipientsForRule(
  prisma: PrismaService,
  recipientTokens: string[],
  ctx: NotificationEventContext,
): Promise<ResolvedRecipientUser[]> {
  const userIds = new Set<string>();
  const roleCodes = new Set<string>();

  for (const id of ctx.explicitUserIds ?? []) {
    if (id) userIds.add(id);
  }

  let teamId = ctx.teamId ?? null;
  if (!teamId && (ctx.leadOwnerId || ctx.assetAgentId || ctx.appointmentAgentId)) {
    const refUserId = ctx.leadOwnerId ?? ctx.assetAgentId ?? ctx.appointmentAgentId;
    if (refUserId) {
      const refUser = await prisma.user.findUnique({
        where: { id: refUserId },
        select: { teamId: true },
      });
      teamId = refUser?.teamId ?? null;
    }
  }

  for (const token of recipientTokens) {
    if (UUID_REGEX.test(token)) {
      userIds.add(token);
      continue;
    }
    switch (token) {
      case "LEAD_OWNER":
        if (ctx.leadOwnerId) userIds.add(ctx.leadOwnerId);
        break;
      case "NEW_OWNER":
        if (ctx.newOwnerId) userIds.add(ctx.newOwnerId);
        break;
      case "PREVIOUS_OWNER":
        if (ctx.previousOwnerId) userIds.add(ctx.previousOwnerId);
        break;
      case "ACTOR":
        if (ctx.actorId) userIds.add(ctx.actorId);
        break;
      case "APPOINTMENT_AGENT":
        if (ctx.appointmentAgentId) userIds.add(ctx.appointmentAgentId);
        break;
      case "APPOINTMENT_COORDINATOR":
        if (ctx.appointmentCoordinatorId) userIds.add(ctx.appointmentCoordinatorId);
        break;
      case "APPOINTMENT_PARTICIPANTS":
        if (ctx.appointmentAgentId) userIds.add(ctx.appointmentAgentId);
        if (ctx.appointmentCoordinatorId) userIds.add(ctx.appointmentCoordinatorId);
        break;
      case "ASSET_AGENT":
        if (ctx.assetAgentId) userIds.add(ctx.assetAgentId);
        break;
      case "TEAM_MANAGER":
        if (teamId) {
          const team = await prisma.team.findUnique({
            where: { id: teamId },
            select: { managerId: true },
          });
          if (team?.managerId) userIds.add(team.managerId);
        }
        break;
      case "ACCOUNTING":
        roleCodes.add("ACCOUNTING");
        break;
      case "APPROVER":
        if (teamId) {
          const team = await prisma.team.findUnique({
            where: { id: teamId },
            select: { managerId: true },
          });
          if (team?.managerId) userIds.add(team.managerId);
        } else {
          roleCodes.add("MANAGER");
          roleCodes.add("ACCOUNTING");
        }
        break;
      case "ADMIN":
      case "MANAGER":
      case "AGENT":
        roleCodes.add(token);
        break;
    }
  }

  const orClauses: Array<Record<string, unknown>> = [];
  if (userIds.size > 0) {
    orClauses.push({ id: { in: Array.from(userIds) } });
  }
  if (roleCodes.size > 0) {
    orClauses.push({
      roles: { some: { role: { code: { in: Array.from(roleCodes) } } } },
    });
  }
  if (orClauses.length === 0) return [];

  const users = await prisma.user.findMany({
    where: {
      archivedAt: null,
      isActive: true,
      OR: orClauses,
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      lineUserId: true,
      notificationPrefs: true,
    },
  });

  return users.map((u) => ({
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    lineUserId: u.lineUserId,
    notificationPrefs: parseNotificationPrefs(u.notificationPrefs),
  }));
}

export function parseNotificationPrefs(raw: unknown): Record<string, NotificationChannelType[]> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const result: Record<string, NotificationChannelType[]> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (Array.isArray(v)) {
      result[k] = v.filter((c): c is NotificationChannelType => c === "IN_APP" || c === "EMAIL" || c === "LINE");
    }
  }
  return result;
}

export function resolveEffectiveChannels(
  ruleChannels: NotificationChannelType[],
  userPrefs: Record<string, NotificationChannelType[]>,
  event: string,
): NotificationChannelType[] {
  const custom = userPrefs[event];
  if (custom !== undefined) {
    return custom;
  }
  return ruleChannels;
}
