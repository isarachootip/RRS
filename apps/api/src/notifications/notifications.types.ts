import { z } from "zod";

export const NotificationChannelEnum = z.enum(["IN_APP", "EMAIL", "LINE"]);
export type NotificationChannelType = z.infer<typeof NotificationChannelEnum>;

export const ListNotificationsQuerySchema = z.object({
  unreadOnly: z.enum(["true", "false"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
export type ListNotificationsQueryDto = z.infer<typeof ListNotificationsQuerySchema>;

export const UpdateNotificationRuleSchema = z.object({
  description: z.string().min(1).max(300).optional(),
  isEnabled: z.boolean().optional(),
  recipients: z.array(z.string().min(1)).min(1).optional(),
  timing: z.record(z.string(), z.unknown()).optional(),
  channels: z.array(NotificationChannelEnum).min(1).optional(),
});
export type UpdateNotificationRuleDto = z.infer<typeof UpdateNotificationRuleSchema>;

export const UpdateNotificationPrefsSchema = z.object({
  preferences: z.record(z.string(), z.array(NotificationChannelEnum)),
});
export type UpdateNotificationPrefsDto = z.infer<typeof UpdateNotificationPrefsSchema>;

export const LinkLineSchema = z.object({
  lineUserId: z.string().min(3, "กรุณาระบุ LINE User ID หรือรหัสเชื่อมบัญชี").max(120),
});
export type LinkLineDto = z.infer<typeof LinkLineSchema>;

export const RunScheduledJobsSchema = z.object({
  now: z.string().datetime().optional(),
});
export type RunScheduledJobsDto = z.infer<typeof RunScheduledJobsSchema>;

export interface NotificationEventContext {
  actorId?: string | null;
  teamId?: string | null;
  leadOwnerId?: string | null;
  newOwnerId?: string | null;
  previousOwnerId?: string | null;
  appointmentAgentId?: string | null;
  appointmentCoordinatorId?: string | null;
  assetAgentId?: string | null;
  explicitUserIds?: string[];
}

export interface NotificationEventPayload {
  event: string;
  title: string;
  body?: string;
  link?: string;
  /** คีย์พื้นฐานสำหรับสร้าง dedupeKey ต่อผู้รับ เช่น "lead.created:lead-123" */
  dedupeBaseKey: string;
  context: NotificationEventContext;
  /** ถ้าระบุผู้รับตรงๆ จะข้ามการ resolve จาก rule.recipients */
  overrideRecipients?: string[];
}

export interface ResolvedRecipientUser {
  id: string;
  email: string;
  fullName: string;
  lineUserId: string | null;
  notificationPrefs: Record<string, NotificationChannelType[]>;
}

export interface NotificationJobData {
  userId: string;
  email: string;
  lineUserId: string | null;
  event: string;
  title: string;
  body?: string;
  link?: string;
  dedupeKey: string;
  channels: NotificationChannelType[];
}

export interface SseNotificationMessage {
  userId: string;
  notification: {
    id: string;
    event: string;
    title: string;
    body: string | null;
    link: string | null;
    readAt: string | null;
    createdAt: string;
  };
}

export const DEFAULT_NOTIFICATION_RULES: Array<{
  event: string;
  description: string;
  recipients: string[];
  timing?: Record<string, unknown>;
  channels: NotificationChannelType[];
}> = [
  { event: "lead.created", description: "มีลูกค้าใหม่เข้าระบบ", recipients: ["TEAM_MANAGER"], channels: ["IN_APP"] },
  {
    event: "lead.assigned",
    description: "มอบหมาย/โอนลูกค้า",
    recipients: ["NEW_OWNER", "PREVIOUS_OWNER"],
    channels: ["IN_APP", "LINE"],
  },
  {
    event: "lead.duplicate_detected",
    description: "Agent อื่นกำลังดูแลลูกค้ารายเดียวกัน",
    recipients: ["ACTOR", "LEAD_OWNER"],
    channels: ["IN_APP"],
  },
  {
    event: "lead.inactive",
    description: "ลูกค้าไม่มีกิจกรรมเกินกำหนด",
    recipients: ["TEAM_MANAGER"],
    timing: { inactiveDays: 30 },
    channels: ["IN_APP"],
  },
  {
    event: "appointment.reminder",
    description: "ใกล้ถึงเวลานัดดูห้อง",
    recipients: ["APPOINTMENT_AGENT", "APPOINTMENT_COORDINATOR"],
    timing: { minutesBefore: [1440, 120] },
    channels: ["IN_APP", "LINE"],
  },
  {
    event: "appointment.changed",
    description: "เลื่อนหรือยกเลิกนัด",
    recipients: ["APPOINTMENT_PARTICIPANTS"],
    channels: ["IN_APP", "LINE"],
  },
  {
    event: "followup.due",
    description: "ถึง/เลยกำหนดติดตามลูกค้า",
    recipients: ["LEAD_OWNER"],
    timing: { atHour: 9, escalateToManagerAfterDays: 1 },
    channels: ["IN_APP"],
  },
  {
    event: "booking.created",
    description: "มีการจองห้อง",
    recipients: ["TEAM_MANAGER", "ASSET_AGENT", "ACCOUNTING"],
    channels: ["IN_APP", "EMAIL"],
  },
  {
    event: "contract.expiring",
    description: "ใกล้หมดสัญญาเช่า",
    recipients: ["ASSET_AGENT", "TEAM_MANAGER"],
    timing: { daysBefore: [90, 60, 30] },
    channels: ["IN_APP", "EMAIL"],
  },
  {
    event: "listing_agreement.expiring",
    description: "ใกล้หมดสัญญาฝากเช่า/ฝากขาย",
    recipients: ["ASSET_AGENT", "TEAM_MANAGER"],
    timing: { daysBefore: [90, 60, 30] },
    channels: ["IN_APP"],
  },
  {
    event: "commission.due",
    description: "ถึงกำหนดรับหรือจ่ายค่านายหน้า",
    recipients: ["ACCOUNTING"],
    channels: ["IN_APP", "EMAIL"],
  },
  {
    event: "approval.pending",
    description: "มีรายการรออนุมัติ",
    recipients: ["APPROVER"],
    timing: { dailyDigestHour: 9 },
    channels: ["IN_APP", "EMAIL"],
  },
];
