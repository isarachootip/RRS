import type { Locale } from "@/i18n/dictionaries";
import type { PortalDictionary } from "@/i18n/locales-th-en";
import type { PublicListingItem } from "./public-api";

type PortalAsset = PublicListingItem["asset"];

const ATTR_LABELS_TH: Record<string, string> = {
  land: "ขนาดที่ดิน",
  bays: "จำนวนคูหา",
  stories: "จำนวนชั้น",
  hasMezzanine: "ชั้นลอย",
  frontageM: "หน้ากว้าง (ม.)",
  depthM: "ความลึก (ม.)",
  buildingAreaSqm: "พื้นที่อาคาร (ตร.ม.)",
  officeAreaSqm: "พื้นที่สำนักงาน (ตร.ม.)",
  powerKva: "หม้อแปลงไฟฟ้า (kVA)",
  ceilingHeightM: "ความสูงเพดาน (ม.)",
  floorLoadTonPerSqm: "รับน้ำหนักพื้น (ตัน/ตร.ม.)",
  floorLoadKgSqm: "รับน้ำหนักพื้น (กก./ตร.ม.)",
  hasFactoryLicense: "ใบอนุญาตโรงงาน (รง.4)",
  boiZone: "เขตส่งเสริม BOI",
  commonFeePerSqm: "ค่าส่วนกลาง (บาท/ตร.ม.)",
  commonFeePerMonth: "ค่าส่วนกลาง (บาท/เดือน)",
  parkingSlots: "ที่จอดรถ (คัน)",
  facing: "ทิศระเบียง/ห้อง",
  titleDeedType: "เอกสารสิทธิ์",
  zoning: "ผังเมือง",
  zoningColor: "ผังเมือง",
  roadAccess: "ถนนหน้าที่ดิน",
  waterRatePerUnit: "ค่าน้ำ (บาท/ยูนิต)",
  electricRatePerUnit: "ค่าไฟ (บาท/ยูนิต)",
  allowsDailyRent: "รองรับเช่ารายวัน",
  totalUnits: "จำนวนห้องทั้งหมด",
  totalFloors: "จำนวนชั้นทั้งหมด",
  occupancyRatePercent: "อัตราผู้เช่า (%)",
  monthlyIncome: "รายได้ต่อเดือน (บาท)",
};

const TITLE_DEED_TH: Record<string, string> = {
  CHANOTE: "โฉนดครุฑแดง (น.ส.4 จ.)",
  NOR_SOR_3_GOR: "น.ส.3 ก.",
  NOR_SOR_3: "น.ส.3",
  SOR_POR_KOR: "ส.ป.ก.",
  OTHER: "อื่นๆ",
};

const ROOM_TYPE_TH: Record<string, string> = {
  STUDIO: "สตูดิโอ",
  ONE_BEDROOM: "1 ห้องนอน",
  TWO_BEDROOMS: "2 ห้องนอน",
  THREE_BEDROOMS: "3 ห้องนอน",
  PENTHOUSE: "เพนต์เฮาส์",
  DUPLEX: "ดูเพล็กซ์ 2 ชั้น",
  OTHER: "อื่นๆ",
};

export function formatPortalLand(raw: unknown, locale: Locale): string {
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

export function getPortalCategoryLabel(category: string, locale: Locale, d: PortalDictionary): string {
  const key = `cat${category}` as keyof PortalDictionary;
  if (key in d) return locale === "th" && category === "COMMERCIAL" ? "อาคารพาณิชย์ / ห้องแถว" : d[key];
  if (category === "APARTMENT_BUILDING") return locale === "th" ? "อาคารอพาร์ตเมนต์" : "Apartment Building";
  return category;
}

export function buildPortalCardBadges(asset: PortalAsset, locale: Locale): string[] {
  const isTh = locale === "th";
  const attrs = asset.attributes ?? {};
  const landText = formatPortalLand(attrs.land, locale);
  const out: string[] = [];

  switch (asset.category) {
    case "CONDO":
    case "APARTMENT_UNIT":
      if (asset.areaSqm != null) out.push(isTh ? `${asset.areaSqm} ตร.ม.` : `${asset.areaSqm} sqm`);
      if (asset.floor != null) out.push(isTh ? `ชั้น ${asset.floor}` : `Fl. ${asset.floor}`);
      if (asset.bedrooms != null) out.push(isTh ? `${asset.bedrooms} ห้องนอน` : `${asset.bedrooms} Bed`);
      if (asset.bathrooms != null) out.push(isTh ? `${asset.bathrooms} ห้องน้ำ` : `${asset.bathrooms} Bath`);
      break;
    case "HOUSE":
    case "TOWNHOME":
      if (landText) out.push(isTh ? `ที่ดิน ${landText}` : `Land ${landText}`);
      if (asset.areaSqm != null) out.push(isTh ? `${asset.areaSqm} ตร.ม.` : `${asset.areaSqm} sqm`);
      if (attrs.stories != null) out.push(isTh ? `${attrs.stories} ชั้น` : `${attrs.stories} Fl.`);
      if (asset.bedrooms != null) out.push(isTh ? `${asset.bedrooms} ห้องนอน` : `${asset.bedrooms} Bed`);
      break;
    case "COMMERCIAL": {
      const bays = Number(attrs.bays ?? 1);
      out.push(isTh ? `${bays} คูหา` : `${bays} Bay(s)`);
      if (attrs.stories != null) {
        const mez = attrs.hasMezzanine ? (isTh ? " + ชั้นลอย" : " + Mezzanine") : "";
        out.push(isTh ? `${attrs.stories} ชั้น${mez}` : `${attrs.stories} Fl.${mez}`);
      }
      if (attrs.frontageM && attrs.depthM) out.push(isTh ? `กว้าง ${attrs.frontageM}x${attrs.depthM} ม.` : `${attrs.frontageM}x${attrs.depthM}m`);
      if (asset.areaSqm != null) out.push(isTh ? `${asset.areaSqm} ตร.ม.` : `${asset.areaSqm} sqm`);
      break;
    }
    case "LAND":
      if (landText) out.push(landText);
      if (typeof attrs.titleDeedType === "string") out.push(isTh ? (TITLE_DEED_TH[attrs.titleDeedType] ?? attrs.titleDeedType) : attrs.titleDeedType);
      if (attrs.frontageM) out.push(isTh ? `หน้ากว้าง ${attrs.frontageM} ม.` : `Width ${attrs.frontageM}m`);
      break;
    case "FACTORY":
    case "WAREHOUSE": {
      const bldArea = Number(attrs.buildingAreaSqm ?? asset.areaSqm ?? 0);
      if (bldArea > 0) out.push(isTh ? `อาคาร ${bldArea} ตร.ม.` : `Bldg ${bldArea} sqm`);
      if (landText) out.push(isTh ? `ที่ดิน ${landText}` : `Land ${landText}`);
      if (attrs.powerKva) out.push(isTh ? `ไฟ ${attrs.powerKva} kVA` : `${attrs.powerKva} kVA`);
      if (attrs.hasFactoryLicense) out.push(isTh ? "รง.4" : "Factory License");
      break;
    }
    default:
      if (attrs.totalUnits) out.push(isTh ? `${attrs.totalUnits} ห้อง` : `${attrs.totalUnits} Units`);
      if (attrs.totalFloors) out.push(isTh ? `${attrs.totalFloors} ชั้น` : `${attrs.totalFloors} Floors`);
      if (asset.areaSqm != null) out.push(isTh ? `${asset.areaSqm} ตร.ม.` : `${asset.areaSqm} sqm`);
  }
  return out;
}

export function buildPortalSpecGrid(asset: PortalAsset, locale: Locale, d: PortalDictionary): Array<{ label: string; value: string }> {
  const isTh = locale === "th";
  const attrs = asset.attributes ?? {};
  const landText = formatPortalLand(attrs.land, locale);
  const specs: Array<{ label: string; value: string }> = [];

  if (landText) specs.push({ label: isTh ? "ขนาดที่ดิน" : "Land Area", value: landText });
  if (asset.areaSqm !== null) specs.push({ label: d.specArea, value: isTh ? `${asset.areaSqm} ตร.ม.` : `${asset.areaSqm} sqm` });
  if (asset.category === "COMMERCIAL" && attrs.bays != null) specs.push({ label: isTh ? "จำนวนคูหา" : "Bays", value: isTh ? `${attrs.bays} คูหา` : `${attrs.bays}` });
  if (attrs.stories != null) {
    const mez = attrs.hasMezzanine ? (isTh ? " (มีชั้นลอย)" : " (+Mezzanine)") : "";
    specs.push({ label: isTh ? "จำนวนชั้น" : "Stories", value: `${attrs.stories}${mez}` });
  }
  if (asset.floor !== null && (asset.category === "CONDO" || asset.category === "APARTMENT_UNIT")) {
    specs.push({ label: d.specFloor, value: `${asset.floor}${asset.tower ? ` (${asset.tower})` : ""}` });
  }
  if (asset.roomType && (asset.category === "CONDO" || asset.category === "APARTMENT_UNIT")) {
    specs.push({ label: isTh ? "รูปแบบห้อง" : "Room Type", value: isTh ? (ROOM_TYPE_TH[asset.roomType] ?? asset.roomType) : asset.roomType });
  }
  if (asset.bedrooms !== null && asset.category !== "LAND") specs.push({ label: d.specBedrooms, value: String(asset.bedrooms) });
  if (asset.bathrooms !== null && asset.category !== "LAND") specs.push({ label: d.specBathrooms, value: String(asset.bathrooms) });
  if (asset.furniture && asset.category !== "LAND") specs.push({ label: isTh ? "เฟอร์นิเจอร์" : "Furniture", value: asset.furniture });
  return specs;
}

export function formatPortalAttributeEntries(attributes: Record<string, unknown>, locale: Locale): string[] {
  const isTh = locale === "th";
  const out: string[] = [];
  for (const [key, val] of Object.entries(attributes)) {
    if (val === undefined || val === null || val === "") continue;
    const label = isTh ? (ATTR_LABELS_TH[key] ?? key) : key;
    if (key === "land") {
      const txt = formatPortalLand(val, locale);
      if (txt) out.push(`${label}: ${txt}`);
    } else if (key === "titleDeedType" && typeof val === "string") {
      out.push(`${label}: ${isTh ? (TITLE_DEED_TH[val] ?? val) : val}`);
    } else if (typeof val === "boolean") {
      out.push(`${label}: ${isTh ? (val ? "มี / รองรับ" : "ไม่มี") : val ? "Yes" : "No"}`);
    } else {
      out.push(`${label}: ${typeof val === "object" ? JSON.stringify(val) : String(val)}`);
    }
  }
  return out;
}
