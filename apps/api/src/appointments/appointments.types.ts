import { BadRequestException } from "@nestjs/common";
import type { AppointmentStatus } from "@rrs/db";
import type { Scope } from "@rrs/shared";
import { z } from "zod";
import type { AuthUser } from "../auth/auth.types";

export function parseAppointmentRange(startsAtStr: string, endsAtStr: string) {
  const startsAt = new Date(startsAtStr);
  const endsAt = new Date(endsAtStr);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
    throw new BadRequestException({ code: "INVALID_TIME_RANGE", message: "เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่มนัด" });
  }
  return { startsAt, endsAt };
}

export const createAppointmentSchema = z.object({
  leadId: z.string().uuid("กรุณาเลือกลูกค้า"),
  startsAt: z.string().min(1, "กรุณาระบุวันและเวลาเริ่มนัด"),
  endsAt: z.string().min(1, "กรุณาระบุวันและเวลาสิ้นสุดนัด"),
  location: z.string().max(255).nullable().optional(),
  agentId: z.string().uuid().optional(),
  coordinatorId: z.string().uuid().nullable().optional(),
  coordinatorName: z.string().max(120).nullable().optional(),
  coordinatorPhone: z.string().max(40).nullable().optional(),
  note: z.string().max(1000).nullable().optional(),
  assetIds: z.array(z.string().uuid()).min(1, "กรุณาเลือกห้องที่ต้องการนัดดูอย่างน้อย 1 ห้อง").max(20),
  confirmOverlap: z.boolean().optional(),
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;

export const rescheduleAppointmentSchema = z.object({
  startsAt: z.string().min(1, "กรุณาระบุวันและเวลาเริ่มนัดใหม่"),
  endsAt: z.string().min(1, "กรุณาระบุวันและเวลาสิ้นสุดนัดใหม่"),
  location: z.string().max(255).nullable().optional(),
  agentId: z.string().uuid().optional(),
  coordinatorId: z.string().uuid().nullable().optional(),
  coordinatorName: z.string().max(120).nullable().optional(),
  coordinatorPhone: z.string().max(40).nullable().optional(),
  note: z.string().max(1000).nullable().optional(),
  assetIds: z.array(z.string().uuid()).min(1).max(20).optional(),
  confirmOverlap: z.boolean().optional(),
});

export type RescheduleAppointmentInput = z.infer<typeof rescheduleAppointmentSchema>;

export const followUpOutcomeEnum = z.enum([
  "LIKED",
  "NEGOTIATING_PRICE",
  "WANTS_OTHER_UNITS",
  "CONSIDERING",
  "NOT_INTERESTED",
  "AGREED",
]);

export const appointmentItemOutcomeSchema = z.object({
  assetId: z.string().uuid(),
  outcome: followUpOutcomeEnum,
  outcomeNote: z.string().max(1000).nullable().optional(),
});

export const updateAppointmentStatusSchema = z.object({
  status: z.enum(["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"]),
  note: z.string().max(1000).nullable().optional(),
  outcomes: z.array(appointmentItemOutcomeSchema).optional(),
  nextFollowUpAt: z.string().nullable().optional(),
});

export type UpdateAppointmentStatusInput = z.infer<typeof updateAppointmentStatusSchema>;

export const calendarQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  agentId: z.string().uuid().optional(),
  teamId: z.string().uuid().optional(),
  leadId: z.string().uuid().optional(),
  status: z.enum(["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW", "RESCHEDULED"]).optional(),
});

export type CalendarQueryInput = z.infer<typeof calendarQuerySchema>;

export const checkOverlapQuerySchema = z.object({
  agentId: z.string().uuid(),
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
  excludeId: z.string().uuid().optional(),
});

export type CheckOverlapQueryInput = z.infer<typeof checkOverlapQuerySchema>;

export const appointmentInclude = {
  lead: {
    select: { id: true, code: true, fullName: true, phone: true, ownerAgentId: true, status: true },
  },
  agent: {
    select: { id: true, fullName: true, nickname: true, teamId: true },
  },
  coordinator: {
    select: { id: true, fullName: true, nickname: true, teamId: true },
  },
  rescheduledFrom: {
    select: { id: true, code: true, startsAt: true, endsAt: true },
  },
  rescheduledTo: {
    select: { id: true, code: true, startsAt: true, endsAt: true, status: true },
  },
  items: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      asset: {
        select: {
          id: true,
          code: true,
          category: true,
          unitNo: true,
          status: true,
          project: { select: { id: true, name: true } },
        },
      },
    },
  },
};

export interface AppointmentRecord {
  id: string;
  code: string;
  leadId: string;
  startsAt: Date;
  endsAt: Date;
  location: string | null;
  agentId: string;
  coordinatorId: string | null;
  coordinatorName: string | null;
  coordinatorPhone: string | null;
  status: AppointmentStatus;
  rescheduledFromId: string | null;
  note: string | null;
  lead: { id: string; code: string; fullName: string; phone: string | null; ownerAgentId: string; status: string };
  agent: { id: string; fullName: string; nickname: string | null; teamId: string | null };
  coordinator: { id: string; fullName: string; nickname: string | null; teamId: string | null } | null;
  rescheduledFrom: { id: string; code: string; startsAt: Date; endsAt: Date } | null;
  rescheduledTo: { id: string; code: string; startsAt: Date; endsAt: Date; status: string } | null;
  items: Array<{
    appointmentId: string;
    assetId: string;
    sortOrder: number;
    outcome: string | null;
    outcomeNote: string | null;
    asset: {
      id: string;
      code: string;
      category: string;
      unitNo: string | null;
      status: string;
      project: { id: string; name: string } | null;
    };
  }>;
}

export function formatCalendarAppointment(user: AuthUser, appt: AppointmentRecord, scope: Scope) {
  const isOwn = appt.agentId === user.id || appt.coordinatorId === user.id || appt.lead.ownerAgentId === user.id;
  const isTeam = Boolean(user.teamId && appt.agent.teamId === user.teamId);
  const canViewDetail = scope === "ALL" || (scope === "TEAM" && (isTeam || isOwn)) || (scope === "OWN" && isOwn);

  if (!canViewDetail) {
    return {
      id: appt.id,
      code: null,
      title: "ไม่ว่าง",
      isBusyOnly: true,
      startsAt: appt.startsAt.toISOString(),
      endsAt: appt.endsAt.toISOString(),
      status: appt.status,
      agentId: appt.agentId,
      agent: appt.agent,
      leadId: null,
      lead: null,
      location: null,
      note: null,
      coordinatorId: null,
      coordinatorName: null,
      coordinatorPhone: null,
      rescheduledFromId: null,
      items: [],
    };
  }

  return {
    ...appt,
    title: `${appt.code} · ${appt.lead.fullName}`,
    isBusyOnly: false,
    startsAt: appt.startsAt.toISOString(),
    endsAt: appt.endsAt.toISOString(),
  };
}
