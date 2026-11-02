import { z } from "zod";

export const matchQuerySchema = z.object({
  intent: z.enum(["RENT", "BUY"]).optional(),
  location: z.string().optional(),
  projectId: z.string().uuid().optional(),
  budgetMin: z.coerce.number().min(0).optional(),
  budgetMax: z.coerce.number().min(0).optional(),
  category: z.string().optional(),
  roomType: z.string().optional(),
  minAreaSqm: z.coerce.number().min(0).optional(),
  moveInDate: z.string().optional(),
  leaseMonths: z.coerce.number().int().min(1).optional(),
  petRequired: z.enum(["true", "false"]).optional(),
});

export type MatchQueryInput = z.infer<typeof matchQuerySchema>;

export const createLeadOffersSchema = z.object({
  items: z
    .array(
      z.object({
        assetId: z.string().uuid(),
        offeredPrice: z.number().min(0).nullable().optional(),
        note: z.string().max(500).nullable().optional(),
      }),
    )
    .min(1, "กรุณาเลือกห้องที่ต้องการเสนออย่างน้อย 1 ห้อง")
    .max(20),
});

export type CreateLeadOffersInput = z.infer<typeof createLeadOffersSchema>;

export interface ResolvedMatchCriteria {
  intent: "RENT" | "BUY";
  location: string | null;
  projectId: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  category: string | null;
  roomType: string | null;
  minAreaSqm: number | null;
  moveInDate: Date | null;
  leaseMonths: number | null;
  petRequired: boolean;
}

export interface LeadCriteriaSource {
  intent: "RENT" | "BUY";
  preferredLocation: string | null;
  preferredProjectId: string | null;
  budgetMin: unknown;
  budgetMax: unknown;
  preferredCategory: string | null;
  preferredRoomType: string | null;
  minAreaSqm: unknown;
  moveInDate: Date | null;
  leaseMonths: number | null;
  petRequired: boolean;
}

export function resolveMatchCriteria(lead: LeadCriteriaSource, overrides: MatchQueryInput): ResolvedMatchCriteria {
  return {
    intent: overrides.intent ?? lead.intent,
    location: overrides.location !== undefined ? overrides.location || null : lead.preferredLocation,
    projectId: overrides.projectId ?? lead.preferredProjectId,
    budgetMin:
      overrides.budgetMin !== undefined ? overrides.budgetMin : lead.budgetMin !== null ? Number(lead.budgetMin) : null,
    budgetMax:
      overrides.budgetMax !== undefined ? overrides.budgetMax : lead.budgetMax !== null ? Number(lead.budgetMax) : null,
    category: overrides.category !== undefined ? overrides.category || null : lead.preferredCategory,
    roomType: overrides.roomType !== undefined ? overrides.roomType || null : lead.preferredRoomType,
    minAreaSqm:
      overrides.minAreaSqm !== undefined
        ? overrides.minAreaSqm
        : lead.minAreaSqm !== null
          ? Number(lead.minAreaSqm)
          : null,
    moveInDate: overrides.moveInDate ? new Date(overrides.moveInDate) : lead.moveInDate,
    leaseMonths: overrides.leaseMonths ?? lead.leaseMonths,
    petRequired: overrides.petRequired !== undefined ? overrides.petRequired === "true" : lead.petRequired,
  };
}

export interface ScorableAsset {
  category: string;
  projectId: string | null;
  district: string | null;
  address: string | null;
  areaSqm: unknown;
  roomType: string | null;
  petAllowed: boolean;
  rentPrice: unknown;
  salePrice: unknown;
  availableFrom: Date | null;
  project?: { name: string; district: string | null } | null;
}

export function scoreAssetMatch(
  asset: ScorableAsset,
  criteria: ResolvedMatchCriteria,
): { matchScore: number; matchedReasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  if (criteria.category && asset.category === criteria.category) {
    score += 20;
    reasons.push("ประเภททรัพย์ตรง");
  }

  const priceRaw = criteria.intent === "BUY" ? asset.salePrice : asset.rentPrice;
  const price = priceRaw !== null && priceRaw !== undefined ? Number(priceRaw) : null;
  if (price !== null) {
    const minOk = criteria.budgetMin === null || price >= criteria.budgetMin;
    const maxOk = criteria.budgetMax === null || price <= criteria.budgetMax;
    if (minOk && maxOk) {
      score += 25;
      reasons.push("อยู่ในงบประมาณ");
    } else if (criteria.budgetMax !== null && price <= criteria.budgetMax * 1.15) {
      score += 10;
      reasons.push("ใกล้เคียงงบประมาณ");
    }
  }

  if (criteria.projectId && asset.projectId === criteria.projectId) {
    score += 15;
    reasons.push("โครงการตรง");
  }

  if (criteria.location) {
    const loc = criteria.location.toLowerCase();
    const text = [asset.project?.name, asset.project?.district, asset.district, asset.address]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (text.includes(loc)) {
      score += 15;
      reasons.push("ทำเลตรง");
    }
  }

  if (criteria.roomType && asset.roomType === criteria.roomType) {
    score += 10;
    reasons.push("รูปแบบห้องตรง");
  }

  const area = asset.areaSqm !== null && asset.areaSqm !== undefined ? Number(asset.areaSqm) : null;
  if (criteria.minAreaSqm !== null && area !== null && area >= criteria.minAreaSqm) {
    score += 10;
    reasons.push("ขนาดพื้นที่ผ่านเกณฑ์");
  }

  if (criteria.moveInDate && (!asset.availableFrom || asset.availableFrom <= criteria.moveInDate)) {
    score += 5;
    reasons.push("พร้อมเข้าอยู่ทันกำหนด");
  }

  return { matchScore: score, matchedReasons: reasons };
}
