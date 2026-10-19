import { resetTestDb as reset } from "../src/testing";

/** ล้างฐานทดสอบของแพ็กเกจนี้ (TEST_DATABASE_URL) แล้วรัน migration ใหม่ */
export async function resetTestDb(): Promise<void> {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL not set");
  await reset(url);
}
