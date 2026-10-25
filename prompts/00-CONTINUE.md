# Prompt สั่ง AI พัฒนาต่อ (วางใน Claude Code ที่โฟลเดอร์ RRS)

```text
คุณคือนักพัฒนาหลักของโปรเจกต์ RRS (ระบบบริหารงานเช่า/ขายอสังหาริมทรัพย์) ทำงานต่อจากที่ค้างไว้

## อ่านก่อนเริ่ม (ตามลำดับ)
1. CLAUDE.md — กฎที่ห้ามละเมิด 11 ข้อ
2. docs/progress.md — งานที่เสร็จแล้ว (P01–P03) และงานถัดไป
3. docs/decisions.md — กฎธุรกิจที่ตัดสินแล้ว; รายการ "สมมติฐาน" ยังรอยืนยัน ห้ามเปลี่ยนเองเงียบ ๆ
4. docs/ai-playbook.md ข้อ 3 — ลำดับงาน P01–P22 และงานที่ต้องเสร็จก่อน
5. prompts/<เลขงาน>.md — รายละเอียดและเกณฑ์เสร็จของงานที่กำลังทำ

## สถานะปัจจุบันของโค้ด (อย่าสร้างซ้ำ ให้ต่อยอด)
- packages/db: Prisma schema 36 ตาราง + migration 3 ชุด (init, constraints, auth_tokens), seed (ผู้ใช้ 8 คน รหัส RrsDev#2026, ทรัพย์ 30, lead 50), helper เทสต์ `@rrs/db/testing` (resetTestDb)
- packages/shared: PERMISSIONS + DEFAULT_ROLE_PERMISSIONS (สิทธิ์ + scope ALL/TEAM/OWN), assetAttributesSchemas, normalizePhone/maskPhone
- apps/api (NestJS): JwtAuthGuard เป็น global guard (@Public() สำหรับ endpoint ที่ไม่ต้องล็อกอิน), @CurrentUser(), AuditService.log(), MailService (โหมด log), ZodPipe, AllExceptionsFilter (error ภาษาไทย), /api/v1/auth/* ครบ; GET /api/v1/auth/me คืน roles + permissions ที่รวมแล้ว
- apps/web (Next.js): AppShell เมนูไทย, AuthProvider/useAuth, api() เติม token และ refresh อัตโนมัติ, หน้า login/2FA/ลืมรหัส, i18n ที่ src/i18n/th.ts
- apps/portal: โครง TH/EN
- เทสต์: packages/db ใช้ฐาน rrs_test, apps/api ใช้ rrs_api_test (สร้างให้อัตโนมัติ), E2E Playwright ต้อง migrate + seed ฐาน rrs ก่อน

## สภาพแวดล้อม
- Windows + PowerShell, Node 22, pnpm 10
- ฐานข้อมูล: `docker compose up -d` (PostgreSQL 16 พอร์ต 5433 — ไม่ใช่ 5432 ซึ่งเป็น PostgreSQL 17 ที่ติดตั้งในเครื่อง ห้ามแตะ)
- ถ้า Docker ไม่ทำงาน ให้หยุดและบอกฉันให้เปิด Docker Desktop อย่าเปลี่ยนไปใช้ฐานอื่นเอง
- .env มี secret แล้ว ห้ามแสดงค่า ห้าม commit

## วิธีทำงานต่อหนึ่งงาน
1. เลือกงานถัดไปที่ยังไม่เสร็จจาก docs/progress.md (ตอนนี้คือ P04) แล้วสร้าง branch `feat/p04-rbac` จาก main ที่อัปเดตล่าสุด
2. อ่าน prompts/P04.md แล้วเสนอแผนสั้น ๆ: ไฟล์ที่จะแก้, migration (ถ้ามี), เทสต์ที่จะเขียน, คำถามกฎธุรกิจที่ยังไม่ชัด — รอฉันตอบ "ทำเลย" ก่อนลงมือ
3. เขียนเทสต์ก่อนสำหรับกฎเรื่องเงิน สิทธิ์ และการกันจองซ้ำ แล้วจึงเขียนโค้ด
4. ก่อนบอกว่าเสร็จ ต้องผ่านทั้งหมด: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm format:check` และ `pnpm e2e` ถ้างานแตะหน้าเว็บ
5. เปลี่ยน schema: แก้ schema.prisma แล้ว `pnpm db:migrate:dev --name <ชื่อ>`; กฎที่ Prisma เขียนไม่ได้ให้เพิ่มเป็น migration SQL แล้วตรวจ drift ด้วย `prisma migrate diff`; ห้าม `prisma migrate reset`
6. อัปเดต docs/progress.md (สถานะ + สรุปบรรทัดเดียว) และ docs/decisions.md ถ้ามีการตัดสินใจใหม่
7. commit เป็นภาษาอังกฤษ บอกว่าทำอะไร แล้ว push branch และบอกฉันให้เปิด Pull Request — ห้าม push เข้า main โดยตรง
8. จบงานสรุป: ไฟล์ที่แก้, migration ที่เพิ่ม, จำนวนเทสต์, วิธีลองด้วยมือ, สิ่งที่ค้าง แล้วหยุดรอ ห้ามเริ่มงานถัดไปเอง

## ข้อห้าม
- ห้ามเดากฎธุรกิจ ถ้าไม่ชัดให้ถาม และบันทึกคำตอบลง docs/decisions.md
- ห้ามลบหรือแก้เทสต์เดิมเพื่อให้ผ่าน ถ้าเทสต์เดิมผิดให้บอกเหตุผลก่อน
- ห้ามเพิ่ม dependency ใหม่โดยไม่บอกเหตุผล ใช้เวอร์ชันที่ออกมาแล้วอย่างน้อย 2 สัปดาห์และระบุเวอร์ชันตายตัว
- ห้ามแตะข้อมูลจริง production หรือฐาน PostgreSQL 17 ในเครื่อง

เริ่มจากอ่านไฟล์ข้างบน แล้วเสนอแผนสำหรับ P04
```

## ใช้งาน

1. เปิด Docker Desktop
2. เปิด PowerShell ที่ `C:\oil\claude_project\RRS` แล้วพิมพ์ `claude`
3. วาง prompt ข้างบนทั้งก้อน
4. อ่านแผนที่ AI เสนอ ตอบคำถามที่ AI ถาม แล้วพิมพ์ `ทำเลย`
5. งานเสร็จ ใช้ `prompts/R1.md` ใน session ใหม่เพื่อรีวิว แล้ว merge Pull Request บน GitHub
6. งานถัดไป พิมพ์สั้น ๆ ได้เลย: `ทำงานถัดไปตามขั้นตอนเดิม (อ่าน prompts/00-CONTINUE.md)`
