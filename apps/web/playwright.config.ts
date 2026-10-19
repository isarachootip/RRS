import fs from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// ใช้ Chromium ที่ติดตั้งไว้แล้วในเครื่อง CI/คอนเทนเนอร์ ถ้ามี
const localChromium = "/opt/pw-browsers/chromium";
const executablePath = fs.existsSync(localChromium) ? localChromium : undefined;
const ci = !!process.env.CI;

/**
 * E2E ต้องมีฐานข้อมูลที่ migrate และ seed แล้ว (pnpm db:migrate && pnpm db:seed)
 * Playwright เปิด API (:4000) และหลังบ้าน (:3000) ให้เอง ถ้ายังไม่ได้เปิด
 */
export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: ci ? 1 : 0,
  use: { baseURL: "http://localhost:3000", trace: "on-first-retry", launchOptions: { executablePath } },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } },
  ],
  webServer: [
    {
      command: ci ? "pnpm --filter @rrs/api start" : "pnpm --filter @rrs/api dev",
      url: "http://localhost:4000/health",
      reuseExistingServer: !ci,
      timeout: 120_000,
      env: { AUTH_RATE_LIMIT_PER_MINUTE: "1000" },
    },
    {
      command: ci ? "pnpm start" : "pnpm dev",
      url: "http://localhost:3000/login",
      reuseExistingServer: !ci,
      timeout: 120_000,
    },
  ],
});
