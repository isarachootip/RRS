import { describe, expect, it } from "vitest";
import { maskPhone, normalizePhone, parseAssetAttributes, toSqWah } from "../src";

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

  it("maskPhone", () => {
    expect(maskPhone("+66812345678")).toBe("08x-xxx-5678");
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
