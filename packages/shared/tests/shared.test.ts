import { describe, expect, it } from "vitest";
import {
  abbreviateName,
  buildCategoryHighlights,
  DEFAULT_ROLE_PERMISSIONS,
  formatBahtFromSatang,
  formatDecimalBaht,
  formatLandSizeText,
  fromSatang,
  generateListingDraft,
  maskPhone,
  normalizePhone,
  parseAssetAttributes,
  toSatang,
  toSqWah,
} from "../src";

describe("normalizePhone", () => {
  it.each([
    ["0812345678", "+66812345678"],
    ["081-234-5678", "+66812345678"],
    ["+66 81 234 5678", "+66812345678"],
    ["66812345678", "+66812345678"],
    ["021234567", "+6621234567"],
    ["+86 138 0013 8000", "+8613800138000"],
  ])("%s → %s", (raw, expected) => {
    expect(normalizePhone(raw)).toBe(expected);
  });

  it("0812345678 และ +66812345678 ถือเป็นเบอร์เดียวกัน", () => {
    expect(normalizePhone("0812345678")).toBe(normalizePhone("+66812345678"));
  });

  it.each(["", "abc", "12345", "08123"])("รูปแบบผิด %s → null", (raw) => {
    expect(normalizePhone(raw)).toBeNull();
  });

  it("maskPhone & abbreviateName & D15 manager asset.write scope", () => {
    expect(maskPhone("+66812345678")).toBe("08x-xxx-5678");
    expect(abbreviateName("สมชาย ใจดี")).toBe("สมชาย จ.");
    expect(abbreviateName("สมชาย")).toBe("สมชาย");
    expect(DEFAULT_ROLE_PERMISSIONS.MANAGER["asset.write"]).toBe("TEAM");
  });
});

describe("asset attributes", () => {
  it("คอนโดรับ attributes ว่างได้", () => {
    expect(parseAssetAttributes("CONDO", {})).toEqual({});
  });

  it("บ้านต้องมีขนาดที่ดินและจำนวนชั้น", () => {
    expect(() => parseAssetAttributes("HOUSE", {})).toThrow();
    const a = parseAssetAttributes("HOUSE", { land: { rai: 0, ngan: 1, sqWah: 20 }, stories: 2 });
    expect(toSqWah(a.land)).toBe(120);
  });

  it("โรงงานปฏิเสธฟิลด์ที่ไม่ใช่ของประเภทนี้", () => {
    expect(() => parseAssetAttributes("FACTORY", { buildingAreaSqm: 1200, bedrooms: 3 })).toThrow();
    expect(parseAssetAttributes("FACTORY", { buildingAreaSqm: 1200, powerKva: 500 }).powerKva).toBe(500);
  });

  it("ที่ดินต้องระบุประเภทเอกสารสิทธิ์", () => {
    expect(() => parseAssetAttributes("LAND", { land: { rai: 2 } })).toThrow();
    expect(parseAssetAttributes("LAND", { land: { rai: 2 }, titleDeedType: "CHANOTE" }).land.ngan).toBe(0);
  });

  it("ห้องอพาร์ตเมนต์ default ไม่ให้เช่ารายวัน", () => {
    expect(parseAssetAttributes("APARTMENT_UNIT", {}).allowsDailyRent).toBe(false);
  });

  it("อาคารพาณิชย์/ห้องแถว (COMMERCIAL) รองรับจำนวนคูหา ชั้นลอย และหน้ากว้างxลึก", () => {
    const c = parseAssetAttributes("COMMERCIAL", {
      bays: 2,
      stories: 4,
      hasMezzanine: true,
      frontageM: 8,
      depthM: 12,
      parkingSlots: 3,
      land: { rai: 0, ngan: 0, sqWah: 44 },
    });
    expect(c.bays).toBe(2);
    expect(c.hasMezzanine).toBe(true);
    expect(c.depthM).toBe(12);
  });

  it("สร้างไฮไลท์และคำโปรยประกาศแยกตามประเภททรัพย์ (CONDO vs HOUSE vs COMMERCIAL vs LAND)", () => {
    expect(formatLandSizeText({ rai: 1, ngan: 2, sqWah: 50 }, "th")).toBe("1 ไร่ 2 งาน 50 ตร.วา");
    expect(formatLandSizeText({ rai: 0, ngan: 0, sqWah: 55 }, "th")).toBe("55 ตร.วา");

    const condoBadges = buildCategoryHighlights(
      {
        category: "CONDO",
        areaSqm: 58,
        floor: 31,
        tower: "B",
        bedrooms: 2,
        bathrooms: 2,
        attributes: { facing: "ทิศเหนือ", parkingSlots: 1 },
      },
      "th",
    );
    expect(condoBadges).toContain("58 ตร.ม.");
    expect(condoBadges).toContain("ชั้น 31");
    expect(condoBadges).toContain("2 ห้องนอน");

    const commercialBadges = buildCategoryHighlights(
      {
        category: "COMMERCIAL",
        areaSqm: 240,
        attributes: { bays: 2, stories: 3, hasMezzanine: true, frontageM: 8, depthM: 12 },
      },
      "th",
    );
    expect(commercialBadges).toContain("2 คูหา");
    expect(commercialBadges).toContain("3 ชั้น + ชั้นลอย");
    expect(commercialBadges).toContain("กว้าง 8x12 ม.");

    const houseDraft = generateListingDraft(
      {
        code: "PR-000016",
        category: "HOUSE",
        district: "บางนา",
        province: "กรุงเทพมหานคร",
        areaSqm: 220,
        bedrooms: 4,
        bathrooms: 3,
        rentPrice: 45000,
        salePrice: 8900000,
        project: { name: "เศรษฐสิริ บางนา" },
        attributes: { land: { rai: 0, ngan: 0, sqWah: 65 }, stories: 2, parkingSlots: 2 },
      },
      "SALE",
    );
    expect(houseDraft.suggestedPrice).toBe(8900000);
    expect(houseDraft.titleTh).toContain("บ้านเดี่ยว");
    expect(houseDraft.titleTh).toContain("65 ตร.วา");
    expect(houseDraft.descriptionTh).toContain("2 ชั้น");
  });
});

describe("satang integer money arithmetic", () => {
  it("แปลงบาทเป็นสตางค์และกลับเป็นทศนิยม 2 ตำแหน่งโดยไม่ใช้ float", () => {
    expect(toSatang("25000.50")).toBe(2500050n);
    expect(toSatang("0.01")).toBe(1n);
    expect(toSatang("-1250.75")).toBe(-125075n);
    expect(fromSatang(2500050n)).toBe("25000.50");
    expect(fromSatang(-5n)).toBe("-0.05");
    expect(formatBahtFromSatang(123456789n)).toBe("1,234,567.89");
    expect(formatDecimalBaht("98765.4")).toBe("98,765.40");
  });
});
