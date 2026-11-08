import { describe, expect, it, vi } from "vitest";
import { buildPortalCardBadges, buildPortalSpecGrid, formatPortalAttributeEntries } from "@/lib/category-specs";
import { buildLineOaPropertyMessage, buildLineOaPropertyUrl, normalizeLineOaId } from "@/lib/line-oa";
import { FALLBACK_LISTINGS, buildListingJsonLd, fetchPublicListingBySlug, safeDecodeSlug } from "@/lib/public-api";
import { LOCALES, LOCALE_LABELS, dictionaries, isLocale, isRtlLocale } from "./dictionaries";

describe("P21 Portal 7-Language Dictionaries (th, en, ru, ja, zh, ar, de) & SEO JSON-LD", () => {
  it("รองรับครบทั้ง 7 ภาษา (ไทย, English, Russian, Japanese, Chinese, Arabic, German) และมี key ครบตรงกัน", () => {
    expect(LOCALES).toEqual(["th", "en", "ru", "ja", "zh", "ar", "de"]);
    const keys = Object.keys(dictionaries.th).sort();
    for (const l of LOCALES) {
      expect(Object.keys(dictionaries[l]).sort()).toEqual(keys);
      expect(LOCALE_LABELS[l]).toBeTruthy();
    }
  });

  it("isLocale และ isRtlLocale ตรวจสอบทั้ง 7 ภาษาและทิศทางภาษาอาหรับ (RTL) ได้ถูกต้อง", () => {
    for (const l of ["th", "en", "ru", "ja", "zh", "ar", "de"]) {
      expect(isLocale(l)).toBe(true);
    }
    expect(isLocale("fr")).toBe(false);
    expect(isRtlLocale("ar")).toBe(true);
    expect(isRtlLocale("th")).toBe(false);
    expect(isRtlLocale("en")).toBe(false);
  });

  it("สร้าง Schema.org RealEstateListing + Offer ได้ครบทั้ง 7 ภาษา", () => {
    const sample = FALLBACK_LISTINGS[0]!;
    for (const l of LOCALES) {
      const json = buildListingJsonLd(sample, l);
      expect(json["@type"]).toBe("RealEstateListing");
      expect(json.name).toBe(l === "th" ? sample.titleTh : sample.titleEn);
      expect(json.url).toContain(`/${l}/listings/`);
      expect((json.offers as { price: number; priceCurrency: string }).price).toBe(35000);
      expect((json.offers as { priceCurrency: string }).priceCurrency).toBe("THB");
    }
  });

  it("safeDecodeSlug และ fetchPublicListingBySlug ไม่เข้ารหัสซ้ำซ้อนเมื่อ URL มีภาษาไทย", async () => {
    expect(safeDecodeSlug("%E0%B8%82%E0%B8%B2%E0%B8%A2-pr-000026-sale")).toBe("ขาย-pr-000026-sale");
    expect(safeDecodeSlug("%25E0%25B8%2582%25E0%25B8%25B2%25E0%25B8%25A2-pr-000026-sale")).toBe("ขาย-pr-000026-sale");

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ listing: FALLBACK_LISTINGS[0], nearby: [] }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    await fetchPublicListingBySlug("%E0%B8%82%E0%B8%B2%E0%B8%A2-pr-000026-sale");
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/public/listings/%E0%B8%82%E0%B8%B2%E0%B8%A2-pr-000026-sale"),
      expect.anything(),
    );
    expect(fetchSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("%25E0%25B8"),
      expect.anything(),
    );
    vi.unstubAllGlobals();
  });

  it("แสดงสเปกและจุดเด่นบนเว็บหน้าบ้านแตกต่างกันตามประเภททรัพย์ (คอนโด vs บ้านเดี่ยว vs อาคารพาณิชย์/ห้องแถว vs ที่ดิน)", () => {
    const condoSpecs = buildPortalSpecGrid(FALLBACK_LISTINGS[0]!.asset, "th", dictionaries.th);
    expect(condoSpecs.some((s) => s.label === "ชั้น" && s.value.includes("18"))).toBe(true);

    const houseBadges = buildPortalCardBadges(
      {
        ...FALLBACK_LISTINGS[0]!.asset,
        category: "HOUSE",
        floor: null,
        tower: null,
        areaSqm: 210,
        bedrooms: 4,
        bathrooms: 3,
        attributes: { land: { rai: 0, ngan: 0, sqWah: 65 }, stories: 2, parkingSlots: 2 },
      },
      "th",
    );
    expect(houseBadges).toContain("ที่ดิน 65 ตร.วา");
    expect(houseBadges).toContain("2 ชั้น");
    expect(houseBadges.some((b) => b.includes("ชั้น 18"))).toBe(false);

    const shophouseBadges = buildPortalCardBadges(
      {
        ...FALLBACK_LISTINGS[0]!.asset,
        category: "COMMERCIAL",
        areaSqm: 240,
        attributes: { bays: 2, stories: 4, hasMezzanine: true, frontageM: 8, depthM: 12 },
      },
      "th",
    );
    expect(shophouseBadges).toContain("2 คูหา");
    expect(shophouseBadges).toContain("4 ชั้น + ชั้นลอย");
    expect(shophouseBadges).toContain("กว้าง 8x12 ม.");

    const landAttrs = formatPortalAttributeEntries(
      { land: { rai: 2, ngan: 1, sqWah: 0 }, titleDeedType: "CHANOTE", frontageM: 30, zoning: "สีเหลือง" },
      "th",
    );
    expect(landAttrs).toContain("ขนาดที่ดิน: 2 ไร่ 1 งาน");
    expect(landAttrs).toContain("เอกสารสิทธิ์: โฉนดครุฑแดง (น.ส.4 จ.)");
  });

  it("สร้างลิงก์ LINE OA (oaMessage) พร้อมเติมรหัสทรัพย์และรายละเอียดอัตโนมัติ", () => {
    expect(normalizeLineOaId("tamadee")).toBe("@tamadee");
    expect(normalizeLineOaId("@tamadee")).toBe("@tamadee");
    expect(normalizeLineOaId("")).toBe("@rrs");

    const msg = buildLineOaPropertyMessage({
      assetCode: "PR-000013",
      title: "คอนโด เดอะ ริเวอร์ไซด์",
      price: 21000,
      type: "RENT",
      locale: "th",
    });
    expect(msg).toContain("PR-000013");
    expect(msg).toContain("คอนโด เดอะ ริเวอร์ไซด์");
    expect(msg).toContain("21,000");

    const url = buildLineOaPropertyUrl({
      lineOaId: "tamadee",
      assetCode: "PR-000013",
      title: "คอนโด เดอะ ริเวอร์ไซด์",
      price: 21000,
      type: "RENT",
      locale: "th",
    });
    expect(url).toContain("https://line.me/R/oaMessage/%40tamadee/?");
    expect(decodeURIComponent(url)).toContain("PR-000013");
  });
});
