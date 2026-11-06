import { describe, expect, it } from "vitest";
import { FALLBACK_LISTINGS, buildListingJsonLd } from "@/lib/public-api";
import { LOCALES, dictionaries, isLocale } from "./dictionaries";

describe("P21 Portal dictionaries & SEO JSON-LD", () => {
  it("ทุกภาษามี key เดียวกันครบทุกหน้า", () => {
    const keys = Object.keys(dictionaries.th).sort();
    for (const l of LOCALES) expect(Object.keys(dictionaries[l]).sort()).toEqual(keys);
  });

  it("isLocale ตรวจสอบภาษา th/en ได้ถูกต้อง", () => {
    expect(isLocale("th")).toBe(true);
    expect(isLocale("en")).toBe(true);
    expect(isLocale("fr")).toBe(false);
  });

  it("สร้าง Schema.org RealEstateListing + Offer ได้ครบทั้งภาษาไทยและอังกฤษ", () => {
    const sample = FALLBACK_LISTINGS[0]!;
    const thJson = buildListingJsonLd(sample, "th");
    const enJson = buildListingJsonLd(sample, "en");

    expect(thJson["@type"]).toBe("RealEstateListing");
    expect(thJson.name).toBe(sample.titleTh);
    expect((thJson.offers as { price: number; priceCurrency: string }).price).toBe(35000);
    expect((thJson.offers as { priceCurrency: string }).priceCurrency).toBe("THB");

    expect(enJson.name).toBe(sample.titleEn);
    expect(enJson.url).toContain("/en/listings/");
  });
});
