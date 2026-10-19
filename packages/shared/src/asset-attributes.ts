import { z } from "zod";

/**
 * ฟิลด์เฉพาะประเภทสินทรัพย์ เก็บใน assets.attributes (JSONB)
 * ฟิลด์ร่วมทุกประเภท (ขนาด, ห้องนอน, ราคา ฯลฯ) อยู่เป็นคอลัมน์ปกติในตาราง assets
 * ต้องตรงกับ enum AssetCategory ใน packages/db/prisma/schema.prisma
 */
export const ASSET_CATEGORIES = [
  "CONDO",
  "HOUSE",
  "TOWNHOME",
  "APARTMENT_UNIT",
  "APARTMENT_BUILDING",
  "FACTORY",
  "WAREHOUSE",
  "LAND",
  "COMMERCIAL",
] as const;
export type AssetCategory = (typeof ASSET_CATEGORIES)[number];

const positive = z.number().positive();
const nonNeg = z.number().nonnegative();

/** ขนาดที่ดินแบบไทย ไร่-งาน-ตารางวา */
export const landSize = z
  .object({
    rai: z.number().int().nonnegative().default(0),
    ngan: z.number().int().min(0).max(3).default(0),
    sqWah: z.number().min(0).max(99.99).default(0),
  })
  .strict();
export type LandSize = z.infer<typeof landSize>;

/** แปลง ไร่-งาน-ตร.วา เป็นตารางวา (1 ไร่ = 400 ตร.วา, 1 งาน = 100 ตร.วา) */
export const toSqWah = (l: LandSize) => l.rai * 400 + l.ngan * 100 + l.sqWah;

const condo = z
  .object({
    commonFeePerSqm: nonNeg.optional(),
    parkingSlots: z.number().int().nonnegative().optional(),
    facing: z.string().max(50).optional(),
    facilities: z.array(z.string().max(50)).max(50).optional(),
  })
  .strict();

const house = z
  .object({
    land: landSize,
    stories: z.number().int().min(1).max(10),
    parkingSlots: z.number().int().nonnegative().optional(),
    commonFeePerMonth: nonNeg.optional(),
    yearBuilt: z.number().int().min(1900).max(2100).optional(),
  })
  .strict();

const apartmentUnit = z
  .object({
    waterRatePerUnit: nonNeg.optional(),
    electricRatePerUnit: nonNeg.optional(),
    allowsDailyRent: z.boolean().default(false),
    dailyRate: nonNeg.optional(),
  })
  .strict();

const apartmentBuilding = z
  .object({
    land: landSize.optional(),
    totalUnits: z.number().int().positive(),
    totalFloors: z.number().int().positive(),
    occupancyRatePercent: z.number().min(0).max(100).optional(),
    monthlyIncome: nonNeg.optional(),
  })
  .strict();

const industrial = z
  .object({
    land: landSize.optional(),
    buildingAreaSqm: positive,
    officeAreaSqm: nonNeg.optional(),
    powerKva: nonNeg.optional(),
    ceilingHeightM: positive.optional(),
    floorLoadTonPerSqm: positive.optional(),
    zoning: z.string().max(50).optional(),
    hasFactoryLicense: z.boolean().optional(),
    boiZone: z.boolean().optional(),
    loadingDocks: z.number().int().nonnegative().optional(),
  })
  .strict();

const land = z
  .object({
    land: landSize,
    titleDeedType: z.enum(["CHANOTE", "NOR_SOR_3_GOR", "NOR_SOR_3", "SOR_POR_KOR", "OTHER"]),
    frontageM: positive.optional(),
    zoning: z.string().max(50).optional(),
    roadAccess: z.string().max(100).optional(),
  })
  .strict();

const commercial = z
  .object({
    land: landSize.optional(),
    stories: z.number().int().min(1).max(50),
    frontageM: positive.optional(),
    parkingSlots: z.number().int().nonnegative().optional(),
  })
  .strict();

export const assetAttributesSchemas = {
  CONDO: condo,
  HOUSE: house,
  TOWNHOME: house,
  APARTMENT_UNIT: apartmentUnit,
  APARTMENT_BUILDING: apartmentBuilding,
  FACTORY: industrial,
  WAREHOUSE: industrial,
  LAND: land,
  COMMERCIAL: commercial,
} satisfies Record<AssetCategory, z.ZodTypeAny>;

export type AssetAttributes<C extends AssetCategory> = z.infer<(typeof assetAttributesSchemas)[C]>;

/** ตรวจ attributes ตามประเภท คืนค่าที่ผ่านการ parse (เติม default แล้ว) หรือ throw ZodError */
export function parseAssetAttributes<C extends AssetCategory>(category: C, input: unknown): AssetAttributes<C> {
  return assetAttributesSchemas[category].parse(input ?? {}) as AssetAttributes<C>;
}
