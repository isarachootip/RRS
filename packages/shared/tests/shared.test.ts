import { describe, expect, it } from "vitest";
import {
  abbreviateName,
  DEFAULT_ROLE_PERMISSIONS,
  formatBahtFromSatang,
  formatDecimalBaht,
  fromSatang,
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
