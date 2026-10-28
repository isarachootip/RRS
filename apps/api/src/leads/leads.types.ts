import { type AssetCategory, type LeadIntent, type LeadSource, type LeadStatus, Prisma, type RoomType } from "@rrs/db";

export interface ListLeadsParams {
  search?: string;
  status?: LeadStatus;
  intent?: LeadIntent;
  ownerAgentId?: string;
  includeDirectory?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "createdAt" | "code" | "fullName" | "nextFollowUpAt";
  sortDir?: "asc" | "desc";
}

export interface UpsertLeadInput {
  intent?: LeadIntent;
  fullName?: string;
  phone?: string | null;
  lineId?: string | null;
  email?: string | null;
  nationality?: string | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  preferredLocation?: string | null;
  preferredProjectId?: string | null;
  preferredCategory?: AssetCategory | null;
  preferredRoomType?: RoomType | null;
  minAreaSqm?: number | null;
  occupants?: number | null;
  moveInDate?: string | null;
  leaseMonths?: number | null;
  petRequired?: boolean;
  specialNote?: string | null;
  source?: LeadSource;
  nextFollowUpAt?: string | null;
}

export const MAIN_PIPELINE_ORDER: LeadStatus[] = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "VIEWING",
  "NEGOTIATING",
  "BOOKED",
  "CONTRACTED",
  "CLOSED_WON",
];

export const OFF_TRACK_STATUSES = new Set<LeadStatus>(["LOST", "CANCELLED", "UNDECIDED"]);

/**
 * ตรวจว่าการเปลี่ยนสถานะเป็นการย้อนกลับหรือออกนอกเส้นทาง (ต้องใส่เหตุผล) หรือไม่
 */
export function requiresReasonForStatusChange(fromStatus: LeadStatus, toStatus: LeadStatus): boolean {
  if (fromStatus === toStatus) return false;
  if (OFF_TRACK_STATUSES.has(toStatus)) return true;
  const fromIdx = MAIN_PIPELINE_ORDER.indexOf(fromStatus);
  const toIdx = MAIN_PIPELINE_ORDER.indexOf(toStatus);
  if (fromIdx !== -1 && toIdx !== -1 && toIdx < fromIdx) return true;
  return false;
}

export const leadListInclude = {
  ownerAgent: { select: { id: true, fullName: true, teamId: true } },
  collaborators: { include: { user: { select: { id: true, fullName: true, teamId: true } } } },
} as const;

export const leadDetailInclude = {
  ...leadListInclude,
  preferredProject: true,
  assignments: {
    orderBy: { createdAt: "desc" as const },
    include: {
      fromUser: { select: { id: true, fullName: true } },
      toUser: { select: { id: true, fullName: true } },
      assignedBy: { select: { id: true, fullName: true } },
    },
  },
  activities: {
    orderBy: { createdAt: "desc" as const },
    include: { createdBy: { select: { id: true, fullName: true } } },
  },
} as const;

export const toDec = (n: number | null | undefined) =>
  n === undefined ? undefined : n === null ? null : new Prisma.Decimal(n.toFixed(2));

export function buildLeadCreateData(
  userId: string,
  code: string,
  phone: string | null,
  input: UpsertLeadInput & { fullName: string; source: LeadSource },
): Prisma.LeadUncheckedCreateInput {
  return {
    code,
    intent: input.intent ?? "RENT",
    fullName: input.fullName,
    phone,
    lineId: input.lineId ?? null,
    email: input.email ?? null,
    nationality: input.nationality ?? null,
    budgetMin: toDec(input.budgetMin) ?? null,
    budgetMax: toDec(input.budgetMax) ?? null,
    preferredLocation: input.preferredLocation ?? null,
    preferredProjectId: input.preferredProjectId ?? null,
    preferredCategory: input.preferredCategory ?? null,
    preferredRoomType: input.preferredRoomType ?? null,
    minAreaSqm: toDec(input.minAreaSqm) ?? null,
    occupants: input.occupants ?? null,
    moveInDate: input.moveInDate ? new Date(input.moveInDate) : null,
    leaseMonths: input.leaseMonths ?? null,
    petRequired: input.petRequired ?? false,
    specialNote: input.specialNote ?? null,
    source: input.source,
    ownerAgentId: userId,
    lastActivityAt: new Date(),
    nextFollowUpAt: input.nextFollowUpAt ? new Date(input.nextFollowUpAt) : null,
    createdById: userId,
    updatedById: userId,
    assignments: {
      create: { fromUserId: null, toUserId: userId, assignedById: userId, reason: "สร้างรายการลูกค้าใหม่" },
    },
  };
}

export function buildLeadUpdateData(
  userId: string,
  input: UpsertLeadInput,
  phone: string | null | undefined,
): Prisma.LeadUncheckedUpdateInput {
  return {
    ...(input.intent !== undefined ? { intent: input.intent } : {}),
    ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
    ...(phone !== undefined ? { phone } : {}),
    ...(input.lineId !== undefined ? { lineId: input.lineId } : {}),
    ...(input.email !== undefined ? { email: input.email } : {}),
    ...(input.budgetMin !== undefined ? { budgetMin: toDec(input.budgetMin) } : {}),
    ...(input.budgetMax !== undefined ? { budgetMax: toDec(input.budgetMax) } : {}),
    ...(input.preferredLocation !== undefined ? { preferredLocation: input.preferredLocation } : {}),
    ...(input.preferredCategory !== undefined ? { preferredCategory: input.preferredCategory } : {}),
    ...(input.specialNote !== undefined ? { specialNote: input.specialNote } : {}),
    updatedById: userId,
  };
}
