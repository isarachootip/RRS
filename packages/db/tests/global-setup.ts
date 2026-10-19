import { resetTestDb } from "./reset";

/** ตรวจว่า migration ทั้งหมดรันบนฐานว่างได้ ก่อนเริ่มเทสต์ */
export default async function setup() {
  await resetTestDb();
}
