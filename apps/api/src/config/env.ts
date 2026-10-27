import { z } from "zod";

const bool = (def: "true" | "false") =>
  z
    .enum(["true", "false"])
    .default(def)
    .transform((v) => v === "true");

/** ตรวจค่า .env ตอนเริ่มระบบ — ค่าผิดให้หยุดทันทีพร้อมบอกว่าตัวไหนผิด */
export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url(),
  WEB_ORIGIN: z.string().default("http://localhost:3000"),
  PORTAL_ORIGIN: z.string().default("http://localhost:3001"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  SWAGGER_ENABLED: bool("true"),

  // การยืนยันตัวตน (P03)
  JWT_ACCESS_SECRET: z.string().min(32, "ต้องยาวอย่างน้อย 32 ตัวอักษร"),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(14),
  COOKIE_SECURE: bool("false"),
  COOKIE_DOMAIN: z.string().optional(),
  /** 32 ไบต์ base64 สำหรับเข้ารหัส TOTP secret ในฐานข้อมูล */
  TOTP_ENCRYPTION_KEY: z
    .string()
    .refine((v) => Buffer.from(v, "base64").length === 32, "ต้องเป็น base64 ของข้อมูล 32 ไบต์"),
  TOTP_ISSUER: z.string().default("RRS"),
  LOGIN_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  LOGIN_LOCK_MINUTES: z.coerce.number().int().positive().default(15),
  AUTH_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(10),

  // อีเมล
  MAIL_TRANSPORT: z.enum(["log", "smtp"]).default("log"),
  SMTP_URL: z.string().optional(),
  MAIL_FROM: z.string().default("RRS <no-reply@rrs.local>"),

  // พื้นที่เก็บไฟล์ S3 / MinIO (P05)
  S3_ENDPOINT: z.string().url().default("http://localhost:9000"),
  S3_ACCESS_KEY: z.string().min(1).default("minioadmin"),
  S3_SECRET_KEY: z.string().min(1).default("minioadmin"),
  S3_BUCKET: z.string().min(1).default("rrs-files"),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`ค่าใน .env ไม่ถูกต้อง:\n${issues}`);
  }
  if (parsed.data.MAIL_TRANSPORT === "smtp" && !parsed.data.SMTP_URL) {
    throw new Error("ค่าใน .env ไม่ถูกต้อง:\n  - SMTP_URL: ต้องระบุเมื่อ MAIL_TRANSPORT=smtp");
  }
  return parsed.data;
}
