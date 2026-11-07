import { describe, expect, it, vi } from "vitest";
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
});
