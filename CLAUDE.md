# Property Management Platform

## ระบบนี้คืออะไร

ระบบบริหารงานเช่า/ขายอสังหาริมทรัพย์ 2 แบบในฐานข้อมูลเดียว:

- Owner: บริษัทเป็นเจ้าของ รายได้ = ค่าเช่า/ราคาขาย
- Agent: รับฝากจากเจ้าของ รายได้ = ค่านายหน้า

ผู้ใช้หลังบ้าน: Admin, Manager, Agent, Accounting
มีเว็บสาธารณะ (Public Portal) สำหรับลูกค้าค้นหา เช่า ซื้อ ฝากขาย
สเปกเต็ม: docs/srs.md และ docs/design.md ตัดสินใจกฎธุรกิจ: docs/decisions.md

## Tech stack

- Monorepo pnpm + Turborepo: apps/web (Next.js หลังบ้าน), apps/portal (Next.js เว็บสาธารณะ), apps/api (NestJS), packages/shared (types, zod schemas)
- PostgreSQL 16 + Prisma, Redis + BullMQ, S3-compatible storage
- TypeScript strict ทุกที่, Tailwind, TanStack Table/Query, FullCalendar
- Test: Vitest (unit), Supertest (API), Playwright (E2E)

## คำสั่ง

- pnpm dev / pnpm test / pnpm lint / pnpm typecheck
- pnpm db:migrate / pnpm db:seed / pnpm db:generate
- สร้าง migration ใหม่: แก้ schema.prisma แล้ว `pnpm db:migrate:dev --name <ชื่อ>`
- docker compose up -d (postgres พอร์ต 5433, redis, minio) — ฐาน rrs และ rrs_test สร้างอัตโนมัติ

## กฎที่ห้ามละเมิด

1. เงินใช้ Prisma Decimal / numeric(14,2) คำนวณเป็นสตางค์ ห้ามใช้ float
2. ห้ามลบจริง ใช้ archivedAt/archivedBy
3. ทุกการสร้าง/แก้/archive/อนุมัติ ต้องเขียน audit_logs (before/after JSON) ผ่าน AuditService
4. ตรวจสิทธิ์ที่ API ทุก endpoint ด้วย PermissionGuard + data scope ห้ามพึ่ง UI ซ่อนปุ่ม
5. สัญญาและค่านายหน้าที่อนุมัติแล้ว ห้าม UPDATE ทับ ให้สร้าง revision ใหม่
6. กันจองซ้ำด้วย PostgreSQL EXCLUDE constraint บน daterange
7. เบอร์โทร normalize เป็น E.164 ก่อนบันทึกและตรวจซ้ำ
8. ข้อความ UI เป็นภาษาไทย (i18n key) วันที่แสดงแบบไทย เวลา Asia/Bangkok
9. ห้ามแตะข้อมูลจริงหรือ production; secrets อยู่ใน .env เท่านั้น
10. ห้ามรัน `prisma migrate reset` — เทสต์ล้างเฉพาะฐานที่ชื่อลงท้าย `_test` ผ่าน `packages/db/tests/reset.ts`
11. กฎที่ Prisma เขียนไม่ได้ (EXCLUDE, CHECK, trigger) ให้เพิ่มเป็น migration SQL ใหม่ แล้วตรวจด้วย `prisma migrate diff` ว่าไม่มี drift

## วิธีทำงาน

- เสนอแผนก่อนแก้โค้ดเสมอ ถ้ากฎธุรกิจไม่ชัดให้ถาม ห้ามเดา
- ทุกฟีเจอร์ต้องมีเทสต์ และรัน test + lint + typecheck ให้ผ่านก่อนบอกว่าเสร็จ
- จบงานให้สรุป: ไฟล์ที่แก้, migration ที่เพิ่ม, วิธีทดสอบ, สิ่งที่ยังค้าง
- อัปเดต docs/progress.md ทุกครั้งที่จบงาน
