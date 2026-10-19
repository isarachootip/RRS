/**
 * แปลงเบอร์โทรเป็นรูปแบบ E.164 (+66XXXXXXXXX) เพื่อใช้บันทึกและตรวจซ้ำ
 * รองรับ 08x-xxx-xxxx, 0812345678, +66 81 234 5678, 66812345678
 * เบอร์ต่างประเทศที่ขึ้นต้นด้วย + จะคงรหัสประเทศเดิม
 * คืน null ถ้ารูปแบบไม่ถูกต้อง
 */
export function normalizePhone(input: string | null | undefined, defaultCountry = "66"): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;

  let e164: string;
  if (hasPlus) e164 = digits;
  else if (digits.startsWith("00")) e164 = digits.slice(2);
  else if (digits.startsWith("0")) e164 = defaultCountry + digits.slice(1);
  else if (digits.startsWith(defaultCountry)) e164 = digits;
  else return null;

  if (e164.length < 8 || e164.length > 15) return null;
  if (e164.startsWith("66") && e164.length !== 10 && e164.length !== 11) return null;
  return "+" + e164;
}

/** ปิดบังเบอร์สำหรับแสดงในรายการ เช่น +66812345678 → 08x-xxx-5678 */
export function maskPhone(e164: string | null | undefined): string {
  if (!e164) return "";
  const last4 = e164.slice(-4);
  if (e164.startsWith("+66")) return `0${e164.charAt(3)}x-xxx-${last4}`;
  return `${e164.slice(0, 3)}xxxx${last4}`;
}
