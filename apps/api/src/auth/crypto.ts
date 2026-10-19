import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/** token สุ่มแบบ URL-safe (ส่งให้ผู้ใช้) */
export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");

/** เก็บใน DB เฉพาะ hash ของ token */
export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** เข้ารหัส TOTP secret ด้วย AES-256-GCM: iv.tag.ciphertext (base64url) */
export function encryptSecret(plain: string, keyB64: string): string {
  const key = Buffer.from(keyB64, "base64");
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64url")).join(".");
}

export function decryptSecret(stored: string, keyB64: string): string {
  const [iv, tag, enc] = stored.split(".").map((p) => Buffer.from(p, "base64url"));
  if (!iv || !tag || !enc) throw new Error("invalid encrypted secret");
  const d = createDecipheriv("aes-256-gcm", Buffer.from(keyB64, "base64"), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}
