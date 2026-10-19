/** เว็บสาธารณะรองรับไทย/อังกฤษ (design ข้อ 7.1) — หน้าเต็มทำใน P21 */
export const LOCALES = ["th", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "th";

export const dictionaries = {
  th: {
    title: "หาที่อยู่ ที่ทำงาน หรือทรัพย์สินที่ใช่",
    intro: "คอนโด บ้าน อพาร์ตเมนต์ โรงงาน และที่ดิน ทั้งเช่าและขาย ประกาศจริงจากทีมของเรา",
    soon: "กำลังเตรียมรายการทรัพย์สิน เปิดให้ค้นหาเร็ว ๆ นี้",
    switchTo: "English",
  },
  en: {
    title: "Find the right place to live, work or invest",
    intro: "Condos, houses, apartments, factories and land for rent or sale, listed by our own team.",
    soon: "Listings are being prepared. Search opens soon.",
    switchTo: "ภาษาไทย",
  },
} satisfies Record<Locale, Record<string, string>>;

export function isLocale(x: string): x is Locale {
  return (LOCALES as readonly string[]).includes(x);
}
