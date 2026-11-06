/**
 * เว็บสาธารณะรองรับ 7 ภาษา:
 * ไทย (th), English (en), Русский (ru), 日本語 (ja), 中文 (zh), العربية (ar), Deutsch (de)
 */
import { arDictionary, deDictionary } from "./locales-ar-de";
import { jaDictionary, ruDictionary, zhDictionary } from "./locales-ru-ja-zh";
import { enDictionary, thDictionary, type PortalDictionary } from "./locales-th-en";

export const LOCALES = ["th", "en", "ru", "ja", "zh", "ar", "de"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "th";

export const LOCALE_LABELS: Record<Locale, string> = {
  th: "🇹🇭 ไทย",
  en: "🇬🇧 English",
  ru: "🇷🇺 Русский",
  ja: "🇯🇵 日本語",
  zh: "🇨🇳 中文",
  ar: "🇸🇦 العربية",
  de: "🇩🇪 Deutsch",
};

export const dictionaries: Record<Locale, PortalDictionary> = {
  th: thDictionary,
  en: enDictionary,
  ru: ruDictionary,
  ja: jaDictionary,
  zh: zhDictionary,
  ar: arDictionary,
  de: deDictionary,
};

export function isLocale(x: string): x is Locale {
  return (LOCALES as readonly string[]).includes(x);
}

export function isRtlLocale(locale: Locale): boolean {
  return locale === "ar";
}

export function buildLocaleAlternates(subpath = ""): Record<Locale, string> {
  const suffix = subpath ? (subpath.startsWith("/") ? subpath : `/${subpath}`) : "";
  return {
    th: `/th${suffix}`,
    en: `/en${suffix}`,
    ru: `/ru${suffix}`,
    ja: `/ja${suffix}`,
    zh: `/zh${suffix}`,
    ar: `/ar${suffix}`,
    de: `/de${suffix}`,
  };
}
