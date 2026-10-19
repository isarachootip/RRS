import { type Page, expect, test } from "@playwright/test";

// ผู้ใช้จาก seed (packages/db/src/seed.ts)
const AGENT = { email: "agent1@rrs.local", password: "RrsDev#2026", name: "เอเจนต์ เอ" };

async function login(page: Page, email = AGENT.email, password = AGENT.password) {
  await page.getByLabel("อีเมล").fill(email);
  await page.getByLabel("รหัสผ่าน").fill(password);
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
}

test("ยังไม่ล็อกอิน → ไปหน้าเข้าสู่ระบบ แล้วกลับหน้าเดิมหลังล็อกอิน", async ({ page }) => {
  await page.goto("/leads");
  await expect(page).toHaveURL(/\/login\?next=%2Fleads/);
  await login(page);
  await expect(page).toHaveURL(/\/leads$/);
  await expect(page.getByRole("heading", { name: "ลูกค้า" })).toBeVisible();
});

test("รหัสผ่านผิด → แสดงข้อความ ไม่เข้าระบบ", async ({ page }) => {
  await page.goto("/login");
  await login(page, AGENT.email, "wrong-password-1");
  await expect(page.locator("form").getByRole("alert")).toHaveText("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
  await expect(page).toHaveURL(/\/login/);
});

test("เปลี่ยนหน้าจากเมนู, รีเฟรชแล้วยังล็อกอินอยู่, ออกจากระบบได้", async ({ page, isMobile }) => {
  await page.goto("/login");
  await login(page);
  await expect(page.getByRole("heading", { name: "ภาพรวม" })).toBeVisible();

  if (isMobile) {
    await expect(page.getByTestId("sidebar-desktop")).toBeHidden();
    await page.getByRole("button", { name: "เปิดเมนู" }).click();
    await page.getByTestId("sidebar-drawer").getByRole("link", { name: "ทรัพย์สิน" }).click();
    await expect(page.getByTestId("sidebar-drawer")).toBeHidden();
  } else {
    await page.getByTestId("sidebar-desktop").getByRole("link", { name: "ทรัพย์สิน" }).click();
  }
  await expect(page).toHaveURL(/\/assets$/);

  // refresh cookie ทำให้รีโหลดหน้าแล้วยังอยู่ในระบบ
  await page.reload();
  await expect(page.getByRole("heading", { name: "ทรัพย์สิน" })).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);

  await page.getByRole("button", { name: "บัญชีของฉัน" }).click();
  await page.getByRole("menuitem", { name: "ออกจากระบบ" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/assets");
  await expect(page).toHaveURL(/\/login/);
});

test("Admin ต้องตั้ง 2FA ตอนล็อกอินครั้งแรก", async ({ page }) => {
  await page.goto("/login");
  await login(page, "admin2@rrs.local");
  await expect(page.getByRole("heading", { name: "ตั้งค่าการยืนยันสองขั้นตอน" })).toBeVisible();
  await expect(page.getByAltText(/QR code/)).toBeVisible();
});
