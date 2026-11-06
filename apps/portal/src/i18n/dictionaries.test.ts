import { describe, expect, it } from "vitest";
import { FALLBACK_LISTINGS, buildListingJsonLd } from "@/lib/public-api";
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
});
