import { hash, verify } from "@node-rs/argon2";
import { z } from "zod";

// Argon2id ตามคำแนะนำ OWASP: m=19 MiB, t=2, p=1
const OPTS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export const hashPassword = (plain: string) => hash(plain, OPTS);

export async function verifyPassword(stored: string, plain: string): Promise<boolean> {
  try {
    return await verify(stored, plain);
  } catch {
    return false; // hash เสียหรือยังไม่ได้ตั้งรหัสผ่าน
  }
}

/** ใช้ตรวจเมื่อไม่พบผู้ใช้ เพื่อให้เวลาตอบเท่ากัน (กันการเดาอีเมล) */
let dummyHash: Promise<string> | undefined;
export async function burnPasswordCheck(plain: string) {
  dummyHash ??= hashPassword("dummy-password-for-timing-1");
  await verifyPassword(await dummyHash, plain);
}

export const passwordSchema = z
  .string()
  .min(10, "รหัสผ่านต้องยาวอย่างน้อย 10 ตัวอักษร")
  .max(128, "รหัสผ่านยาวเกิน 128 ตัวอักษร")
  .refine((v) => /[A-Za-zก-๙]/.test(v) && /\d/.test(v), "รหัสผ่านต้องมีทั้งตัวอักษรและตัวเลข");

export function checkPasswordNotEmail(password: string, email: string): string | null {
  const local = email.split("@")[0]?.toLowerCase() ?? "";
  return local.length >= 4 && password.toLowerCase().includes(local) ? "รหัสผ่านต้องไม่มีชื่ออีเมลอยู่ข้างใน" : null;
}
