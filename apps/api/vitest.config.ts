import path from "node:path";
import { config } from "dotenv";
import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

config({ path: path.resolve(__dirname, "../../.env") });

// เทสต์ API ใช้ฐานของตัวเอง (rrs_api_test) เพื่อรันพร้อมเทสต์ของ packages/db ได้
const base = process.env.TEST_DATABASE_URL ?? "postgresql://rrs:rrs@localhost:5433/rrs_test?schema=public";
const apiTestUrl = (() => {
  const u = new URL(base);
  u.pathname = "/rrs_api_test";
  return u.toString();
})();

// SWC ใส่ decorator metadata ให้ NestJS DI (esbuild ของ vitest ทำไม่ได้)
export default defineConfig({
  plugins: [swc.vite({ module: { type: "es6" } })],
  test: {
    include: ["test/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 120_000,
    fileParallelism: false,
    env: {
      NODE_ENV: "test",
      LOG_LEVEL: "silent",
      DATABASE_URL: apiTestUrl,
      API_TEST_DATABASE_URL: apiTestUrl,
      JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET ?? "test-secret-that-is-long-enough-0123456789",
      TOTP_ENCRYPTION_KEY: process.env.TOTP_ENCRYPTION_KEY ?? Buffer.alloc(32, 7).toString("base64"),
      MAIL_TRANSPORT: "log",
      AUTH_RATE_LIMIT_PER_MINUTE: "1000",
    },
  },
});
