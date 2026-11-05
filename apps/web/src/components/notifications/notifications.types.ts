export type NotificationChannelType = "IN_APP" | "EMAIL" | "LINE";

export interface NotificationItem {
  id: string;
  event: string;
  title: string;
  body: string | null;
  link: string | null;
  delivery: Record<string, string>;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationRuleItem {
  id: string;
  event: string;
  description: string;
  isEnabled: boolean;
  recipients: string[];
  timing: Record<string, unknown>;
  channels: NotificationChannelType[];
  updatedAt: string;
}

export interface NotificationsListResponse {
  items: NotificationItem[];
  unreadCount: number;
}

export interface NotificationPreferencesResponse {
  lineUserId: string | null;
  preferences: Record<string, NotificationChannelType[]>;
  rules: NotificationRuleItem[];
}

export const CHANNEL_LABELS: Record<NotificationChannelType, string> = {
  IN_APP: "ในระบบ (In-App)",
  EMAIL: "อีเมล (Email)",
  LINE: "LINE OA",
};

export const ALL_CHANNELS: NotificationChannelType[] = ["IN_APP", "EMAIL", "LINE"];

export const RECIPIENT_TOKEN_LABELS: Record<string, string> = {
  TEAM_MANAGER: "ผู้จัดการทีม (Manager)",
  LEAD_OWNER: "ผู้ดูแลลูกค้า (Lead Owner)",
  NEW_OWNER: "ผู้รับมอบหมายใหม่",
  PREVIOUS_OWNER: "ผู้ดูแลเดิม",
  ACTOR: "ผู้ทำรายการ",
  APPOINTMENT_AGENT: "Agent ผู้นัดดูห้อง",
  APPOINTMENT_COORDINATOR: "ผู้ประสานงานนัด",
  APPOINTMENT_PARTICIPANTS: "ผู้เกี่ยวข้องในนัดทุกคน",
  ASSET_AGENT: "ผู้ดูแลทรัพย์สิน",
  ACCOUNTING: "ฝ่ายบัญชี (Accounting)",
  APPROVER: "ผู้อนุมัติ (Approver)",
};
