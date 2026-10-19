import path from "node:path";
import { config } from "dotenv";
import { defineConfig } from "vitest/config";

config({ path: path.resolve(process.cwd(), "../../.env") });
const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) throw new Error("ตั้งค่า TEST_DATABASE_URL ใน .env ก่อนรันเทสต์ (ดู .env.example)");
if (testUrl === process.env.DATABASE_URL)
  throw new Error("TEST_DATABASE_URL ต้องไม่ใช่ฐานเดียวกับ DATABASE_URL (เทสต์จะล้างข้อมูล)");

export default defineConfig({
  test: {
    env: { DATABASE_URL: testUrl },
    globalSetup: ["tests/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
