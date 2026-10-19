import { describe, expect, it } from "vitest";
import { LOCALES, dictionaries, isLocale } from "./dictionaries";

describe("dictionaries", () => {
  it("ทุกภาษามี key เดียวกัน", () => {
    const keys = Object.keys(dictionaries.th).sort();
    for (const l of LOCALES) expect(Object.keys(dictionaries[l]).sort()).toEqual(keys);
  });
  it("isLocale", () => {
    expect(isLocale("th")).toBe(true);
    expect(isLocale("fr")).toBe(false);
  });
});
