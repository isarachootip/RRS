import type { AssetCategory } from "./asset-attributes";

export interface AssetSpecSummaryInput {
  code?: string;
  category: AssetCategory | string;
  tower?: string | null;
  floor?: number | null;
  district?: string | null;
  province?: string | null;
  areaSqm?: number | string | null;
  roomType?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  furniture?: string | null;
  appliances?: string[];
  petAllowed?: boolean;
  rentPrice?: number | string | null;
  salePrice?: number | string | null;
  project?: { name?: string | null; nameEn?: string | null; nearTransit?: string[] } | null;
  attributes?: Record<string, unknown> | null;
}

export const CATEGORY_NAMES_TH: Record<AssetCategory, string> = {
  CONDO: "คอนโด",
  HOUSE: "บ้านเดี่ยว",
  TOWNHOME: "ทาวน์โฮม",
  APARTMENT_UNIT: "ห้องอพาร์ตเมนต์",
  APARTMENT_BUILDING: "อาคารอพาร์ตเมนต์",
  FACTORY: "โรงงาน",
  WAREHOUSE: "โกดัง",
  LAND: "ที่ดิน",
  COMMERCIAL: "อาคารพาณิชย์/ห้องแถว",
};

export const CATEGORY_NAMES_EN: Record<AssetCategory, string> = {
  CONDO: "Condo",
  HOUSE: "Detached House",
  TOWNHOME: "Townhome",
  APARTMENT_UNIT: "Apartment Unit",
  APARTMENT_BUILDING: "Apartment Building",
  FACTORY: "Factory",
  WAREHOUSE: "Warehouse",
  LAND: "Land",
  COMMERCIAL: "Shophouse / Commercial Building",
};

export const TITLE_DEED_LABELS_TH: Record<string, string> = {
  CHANOTE: "โฉนดครุฑแดง (น.ส.4 จ.)",
  NOR_SOR_3_GOR: "น.ส.3 ก.",
  NOR_SOR_3: "น.ส.3",
  SOR_POR_KOR: "ส.ป.ก.",
  OTHER: "เอกสารสิทธิ์อื่นๆ",
};

export const ROOM_TYPE_LABELS_TH: Record<string, string> = {
  STUDIO: "สตูดิโอ (Studio)",
  ONE_BEDROOM: "1 ห้องนอน",
  TWO_BEDROOMS: "2 ห้องนอน",
  THREE_BEDROOMS: "3 ห้องนอน",
  PENTHOUSE: "เพนต์เฮาส์ (Penthouse)",
  DUPLEX: "ดูเพล็กซ์ (Duplex 2 ชั้น)",
  OTHER: "อื่นๆ",
};

export function formatLandSizeText(raw: unknown, locale = "th"): string {
  if (!raw || typeof raw !== "object") return "";
  const l = raw as { rai?: number; ngan?: number; sqWah?: number };
  const rai = Number(l.rai ?? 0);
  const ngan = Number(l.ngan ?? 0);
  const sqWah = Number(l.sqWah ?? 0);
  if (rai === 0 && ngan === 0 && sqWah === 0) return "";
  if (locale === "th") {
    const parts: string[] = [];
    if (rai > 0) parts.push(`${rai} ไร่`);
    if (ngan > 0) parts.push(`${ngan} งาน`);
    if (sqWah > 0) parts.push(`${sqWah} ตร.วา`);
    return parts.join(" ");
  }
  return `${rai}-${ngan}-${sqWah} Rai-Ngan-SqWah`;
}

export function buildCategoryHighlights(asset: AssetSpecSummaryInput, locale = "th"): string[] {
  const isTh = locale === "th";
  const attrs = (asset.attributes ?? {}) as Record<string, unknown>;
  const area = asset.areaSqm != null && Number(asset.areaSqm) > 0 ? Number(asset.areaSqm) : null;
  const landText = formatLandSizeText(attrs.land, locale);
  const out: string[] = [];

  switch (asset.category) {
    case "CONDO":
    case "APARTMENT_UNIT": {
      if (area) out.push(isTh ? `${area} ตร.ม.` : `${area} sqm`);
      if (asset.floor != null) out.push(isTh ? `ชั้น ${asset.floor}` : `Fl. ${asset.floor}`);
      if (asset.bedrooms != null) out.push(isTh ? `${asset.bedrooms} ห้องนอน` : `${asset.bedrooms} Bed`);
      if (asset.bathrooms != null) out.push(isTh ? `${asset.bathrooms} ห้องน้ำ` : `${asset.bathrooms} Bath`);
      if (typeof attrs.facing === "string" && attrs.facing) out.push(isTh ? `ทิศ${attrs.facing.replace(/^ทิศ/, "")}` : attrs.facing);
      break;
    }
    case "HOUSE":
    case "TOWNHOME": {
      if (landText) out.push(isTh ? `ที่ดิน ${landText}` : `Land ${landText}`);
      if (area) out.push(isTh ? `${area} ตร.ม.` : `${area} sqm`);
      if (attrs.stories != null) out.push(isTh ? `${attrs.stories} ชั้น` : `${attrs.stories} Stories`);
      if (asset.bedrooms != null) out.push(isTh ? `${asset.bedrooms} ห้องนอน` : `${asset.bedrooms} Bed`);
      if (attrs.parkingSlots != null) out.push(isTh ? `จอดรถ ${attrs.parkingSlots} คัน` : `${attrs.parkingSlots} Parking`);
      break;
    }
    case "COMMERCIAL": {
      const bays = Number(attrs.bays ?? 1);
      out.push(isTh ? `${bays} คูหา` : `${bays} Bay(s)`);
      if (attrs.stories != null) {
        const mez = attrs.hasMezzanine ? (isTh ? " + ชั้นลอย" : " + Mezzanine") : "";
        out.push(isTh ? `${attrs.stories} ชั้น${mez}` : `${attrs.stories} Fl.${mez}`);
      }
      if (attrs.frontageM && attrs.depthM) {
        out.push(isTh ? `กว้าง ${attrs.frontageM}x${attrs.depthM} ม.` : `${attrs.frontageM}x${attrs.depthM}m`);
      } else if (attrs.frontageM) {
        out.push(isTh ? `หน้ากว้าง ${attrs.frontageM} ม.` : `Width ${attrs.frontageM}m`);
      }
      if (area) out.push(isTh ? `${area} ตร.ม.` : `${area} sqm`);
      if (landText) out.push(isTh ? `ที่ดิน ${landText}` : `Land ${landText}`);
      break;
    }
    case "LAND": {
      if (landText) out.push(landText);
      if (typeof attrs.titleDeedType === "string") {
        out.push(isTh ? (TITLE_DEED_LABELS_TH[attrs.titleDeedType] ?? attrs.titleDeedType) : attrs.titleDeedType);
      }
      if (attrs.frontageM) out.push(isTh ? `หน้ากว้าง ${attrs.frontageM} ม.` : `Frontage ${attrs.frontageM}m`);
      if (typeof attrs.zoning === "string" && attrs.zoning) out.push(isTh ? `ผังเมือง${attrs.zoning}` : `Zone ${attrs.zoning}`);
      break;
    }
    case "FACTORY":
    case "WAREHOUSE": {
      const bldArea = Number(attrs.buildingAreaSqm ?? area ?? 0);
      if (bldArea > 0) out.push(isTh ? `อาคาร ${bldArea} ตร.ม.` : `Bldg ${bldArea} sqm`);
      if (landText) out.push(isTh ? `ที่ดิน ${landText}` : `Land ${landText}`);
      if (attrs.powerKva) out.push(isTh ? `ไฟ ${attrs.powerKva} kVA` : `${attrs.powerKva} kVA`);
      if (attrs.hasFactoryLicense) out.push(isTh ? "ขอ รง.4 ได้" : "Factory License (Ror.Ngor.4)");
      break;
    }
    case "APARTMENT_BUILDING": {
      if (attrs.totalUnits) out.push(isTh ? `${attrs.totalUnits} ห้อง` : `${attrs.totalUnits} Units`);
      if (attrs.totalFloors) out.push(isTh ? `${attrs.totalFloors} ชั้น` : `${attrs.totalFloors} Floors`);
      if (landText) out.push(isTh ? `ที่ดิน ${landText}` : `Land ${landText}`);
      if (attrs.occupancyRatePercent != null) out.push(isTh ? `ผู้เช่า ${attrs.occupancyRatePercent}%` : `Occupancy ${attrs.occupancyRatePercent}%`);
      break;
    }
  }
  if (asset.petAllowed) out.push(isTh ? "เลี้ยงสัตว์ได้" : "Pet Friendly");
  return out;
}

export function generateListingDraft(asset: AssetSpecSummaryInput, txType: "RENT" | "SALE") {
  const cat = (asset.category as AssetCategory) in CATEGORY_NAMES_TH ? (asset.category as AssetCategory) : "CONDO";
  const catTh = CATEGORY_NAMES_TH[cat];
  const catEn = CATEGORY_NAMES_EN[cat];
  const txTh = txType === "RENT" ? "ให้เช่า" : "ขาย";
  const txEn = txType === "RENT" ? "For Rent" : "For Sale";
  const locTh = [asset.project?.name, asset.district, asset.province].filter(Boolean).join(" ");
  const locEn = [asset.project?.nameEn || asset.project?.name, asset.district, asset.province].filter(Boolean).join(", ");
  const badgesTh = buildCategoryHighlights(asset, "th");
  const badgesEn = buildCategoryHighlights(asset, "en");
  const topSpecTh = badgesTh.slice(0, 2).join(" ");
  const topSpecEn = badgesEn.slice(0, 2).join(" · ");

  const titleTh = [txTh + catTh, locTh, topSpecTh].filter(Boolean).join(" ").trim();
  const titleEn = [`${catEn} ${txEn}`, locEn ? `at ${locEn}` : "", topSpecEn ? `(${topSpecEn})` : ""].filter(Boolean).join(" ").trim();
  const descriptionTh = `รายละเอียด${catTh} (${asset.code ?? ""}): ${badgesTh.join(" · ")}${asset.furniture ? ` · เฟอร์นิเจอร์: ${asset.furniture}` : ""}`;
  const descriptionEn = `${catEn} (${asset.code ?? ""}) specs: ${badgesEn.join(" · ")}.`;
  const rawPrice = txType === "RENT" ? (asset.rentPrice ?? asset.salePrice) : (asset.salePrice ?? asset.rentPrice);
  const suggestedPrice = rawPrice != null && Number(rawPrice) > 0 ? Number(rawPrice) : 25000;

  return { titleTh, titleEn, descriptionTh, descriptionEn, suggestedPrice };
}
