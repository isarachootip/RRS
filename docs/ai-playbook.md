# แผนพัฒนาด้วย AI และชุด Prompt

## 1. วิธีทำงานกับ AI

สั่ง AI ได้จริง โดยใช้ AI coding agent เช่น Claude Code ทำงานใน repo ทีละ prompt: 1 prompt = 1 งาน = 1 Pull Request คนยังต้องเป็นผู้ตัดสินใจกฎธุรกิจ รีวิวโค้ด และทดสอบ ทีมเล็กลงได้เหลือราว 1 Tech Lead + 1 Developer + 1 QA/BA และย่นเวลาจาก 22 สัปดาห์เหลือราว 12-16 สัปดาห์ ขึ้นกับความเร็วในการรีวิว

**ขั้นตอนต่อ 1 prompt**

1. เปิด branch ใหม่ แล้ววาง prompt ใน Claude Code (ที่ root ของ repo)
2. ให้ AI วางแผนก่อน (plan mode) อ่านแผน แก้ถ้าผิดทิศ แล้วจึงให้ลงมือ
3. AI เขียนโค้ด + เทสต์ และรัน `pnpm test` / `pnpm lint` เองจนผ่าน
4. คนรีวิว diff ด้วย prompt รีวิวในข้อ 8 แล้วทดสอบบน staging
5. Merge แล้วอัปเดตสถานะใน `docs/progress.md` (AI ทำให้ได้)

**กติกาที่ทำให้ AI ทำงานได้ดี**

- เก็บ SRS และเอกสารนี้ไว้ใน repo ที่ `docs/` ให้ AI อ้างอิงได้เสมอ
- prompt ละงานเล็ก แก้ไม่เกินราว 15 ไฟล์ ถ้าใหญ่กว่านี้ให้แตกงาน
- ทุก prompt บอก "เกณฑ์เสร็จ" ที่ตรวจได้ด้วยเทสต์ ไม่ใช่แค่ "ทำให้ใช้ได้"
- กฎเงินและสิทธิ์ (ค่านายหน้า, กันจองซ้ำ, data scope) ให้เขียนเทสต์ก่อนโค้ด
- ห้ามให้ AI แตะ production หรือข้อมูลจริง ใช้ข้อมูล seed เท่านั้น
- ถ้า AI ถามคำถามกฎธุรกิจ ให้ตอบแล้วบันทึกคำตอบลง `docs/decisions.md`

คำในวงเล็บเหลี่ยม เช่น `[ใส่คำตอบ]` ใน prompt คือจุดที่ต้องกรอกเองก่อนส่ง

## 2. Prompt 0: ไฟล์ CLAUDE.md

วางไฟล์นี้ที่ root ของ repo ก่อนเริ่มทุกอย่าง Claude Code อ่านไฟล์นี้อัตโนมัติทุก session จึงไม่ต้องอธิบายบริบทซ้ำในทุก prompt

```markdown
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
- pnpm db:migrate / pnpm db:seed
- docker compose up -d (postgres, redis, minio)

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

## วิธีทำงาน
- เสนอแผนก่อนแก้โค้ดเสมอ ถ้ากฎธุรกิจไม่ชัดให้ถาม ห้ามเดา
- ทุกฟีเจอร์ต้องมีเทสต์ และรัน test + lint + typecheck ให้ผ่านก่อนบอกว่าเสร็จ
- จบงานให้สรุป: ไฟล์ที่แก้, migration ที่เพิ่ม, วิธีทดสอบ, สิ่งที่ยังค้าง
- อัปเดต docs/progress.md ทุกครั้งที่จบงาน
```

## 3. ลำดับ Prompt ทั้งหมด

รวม 22 prompt ส่งตามลำดับ เพราะแต่ละงานใช้ตารางและบริการจากงานก่อนหน้า งานที่ไม่พึ่งกันส่งคู่ขนานใน branch แยกได้

| # | Phase | งาน | ต้องเสร็จก่อน |
| --- | --- | --- | --- |
| P01 | 0 | ERD + Prisma schema + seed | – |
| P02 | 0 | ตั้ง monorepo, Docker, CI, staging | P01 |
| P03 | 1 | Auth: login, JWT, 2FA | P02 |
| P04 | 1 | RBAC + data scope + จัดการผู้ใช้/ทีม | P03 |
| P05 | 1 | Audit Log + อัปโหลดไฟล์ | P04 |
| P06 | 2 | เจ้าของทรัพย์ + สินทรัพย์ + รูป | P05 |
| P07 | 2 | Lead + ตรวจซ้ำ + Lead Ownership + กิจกรรม | P06 |
| P08 | 2 | ค้นหา + นำเข้าข้อมูลเดิม | P07 |
| P09 | 3 | จับคู่ห้อง + ห้องที่เสนอ | P08 |
| P10 | 3 | นัดดูห้อง + ปฏิทินทีม + ตรวจนัดซ้อน | P09 |
| P11 | 3 | ผลติดตาม + จอง + กันจองซ้ำ | P10 |
| P12 | 3 | สัญญา + ประวัติ + สถานะห้องอัตโนมัติ + pipeline ขาย | P11 |
| P13 | 4 | รับเงิน, ค่าเช่ารายเดือน, ค่าใช้จ่าย, รายได้สุทธิ Owner | P12 |
| P14 | 4 | Commission engine (เขียนเทสต์ก่อน) | P12 |
| P15 | 4 | อนุมัติ, revision, จ่าย Agent | P13, P14 |
| P16 | 5 | Dashboard + รายงาน + Export | P15 |
| P17 | 5 | กฎแจ้งเตือน + LINE OA + Email | P12 |
| P18 | 6 | E2E test ตาม Acceptance Criteria | P16, P17 |
| P19 | 6 | สคริปต์ย้ายข้อมูล, ทดสอบกู้คืน, คู่มือ | P18 |
| P20 | 7 | Listings + ขั้นอนุมัติเผยแพร่ + public API | P12 |
| P21 | 7 | หน้าเว็บ Portal: ค้นหา, รายละเอียด, SEO, 2 ภาษา | P20 |
| P22 | 7 | ฟอร์มสอบถาม/นัดดู/ฝากขาย → CRM | P21, P17 |

## 4. Prompts Phase 0–1: ออกแบบและรากฐาน

### P01 · ERD + Prisma schema

```text
อ่าน docs/srs.md และ docs/design.md (ข้อ 3, 4, 7.1) แล้วออกแบบ Prisma schema ทั้งระบบ

ต้องมี: users, teams, roles, permissions, user_roles, owners, projects, assets (asset_category: CONDO, HOUSE, TOWNHOME, APARTMENT_UNIT, FACTORY, WAREHOUSE, LAND, COMMERCIAL; ownership_type: OWNER, AGENT; attributes JSONB), buildings, asset_media, asset_agents, listing_agreements, listings, leads, lead_assignments, lead_collaborators, activities, lead_offers, appointments, appointment_items, bookings, contracts, contract_parties, payments, rent_schedules, expenses, commissions, commission_splits, commission_revisions, commission_payouts, files, notifications, notification_rules, audit_logs

ข้อกำหนด:
- enum สถานะตาม design ข้อ 4 ทุกตัว
- เงิน Decimal(14,2), ทุกตารางมี createdBy/updatedBy/archivedAt
- เขียน raw SQL migration เพิ่ม: EXCLUDE constraint กันจองซ้ำบน bookings/contracts, pg_trgm index สำหรับชื่อ/เบอร์/โครงการ, REVOKE UPDATE/DELETE บน audit_logs
- zod schema ของ attributes แยกตาม asset_category ใน packages/shared
- seed: 4 บทบาท, ผู้ใช้ตัวอย่างบทบาทละ 2 คน, 2 ทีม, 30 สินทรัพย์หลายประเภท, 50 lead

ส่งมอบ: schema.prisma, migrations, seed, docs/erd.md (Mermaid ER diagram)
เกณฑ์เสร็จ: pnpm db:migrate && pnpm db:seed ผ่านบนฐานว่าง และมีเทสต์ยืนยันว่า insert booking ช่วงวันที่ซ้อนกันถูก reject
ถ้าตรงไหนกฎไม่ชัด ให้รวบรวมเป็นคำถามท้ายแผน อย่าเดา
```

### P02 · ตั้งโปรเจกต์

```text
สร้างโครง monorepo ตาม CLAUDE.md (pnpm + Turborepo): apps/api (NestJS), apps/web (Next.js App Router), apps/portal (Next.js), packages/shared, packages/db (Prisma จาก P01)

- docker-compose: postgres 16, redis, minio
- ESLint + Prettier + TypeScript strict, Vitest, Playwright ตั้งค่าพร้อมเทสต์ตัวอย่าง 1 ตัวต่อแอป
- apps/api: config module อ่าน .env (มี .env.example), health check /health, global exception filter, request logging, Swagger ที่ /docs
- apps/web: layout หลังบ้าน (sidebar, topbar, responsive มือถือ), Tailwind, TanStack Query, i18n ภาษาไทย
- GitHub Actions: lint, typecheck, test, build ทุก PR; deploy staging เมื่อ merge main [ใส่ปลายทาง deploy]

เกณฑ์เสร็จ: clone ใหม่แล้ว docker compose up -d && pnpm i && pnpm dev ใช้งานได้ตาม README และ CI เขียว
```

### P03 · Auth

```text
ทำระบบยืนยันตัวตนใน apps/api และหน้า login ใน apps/web

- login ด้วยอีเมล + รหัสผ่าน (Argon2id), access token JWT 15 นาที + refresh token แบบ rotate เก็บใน httpOnly cookie
- ล็อกบัญชี 15 นาทีหลังผิด 5 ครั้ง, logout ทุกอุปกรณ์
- TOTP 2FA: บังคับสำหรับ ADMIN และ ACCOUNTING, เลือกได้สำหรับบทบาทอื่น
- ลืมรหัสผ่านทางอีเมล (token ใช้ครั้งเดียว 30 นาที)
- บันทึก login สำเร็จ/ล้มเหลวลง audit_logs

เกณฑ์เสร็จ: เทสต์ API ครอบ login, refresh, lockout, 2FA บังคับ และ E2E login ผ่านบนมือถือ (viewport 390px)
```

### P04 · RBAC + data scope

```text
ทำระบบสิทธิ์ตาม design ข้อ 5 (ตารางสิทธิ์ตามบทบาท)

- PermissionGuard + decorator @Can('lead.read') ใช้กับทุก controller; permission เก็บใน DB, Admin เพิ่ม/แก้ได้
- DataScopeService คืน Prisma where ตามผู้ใช้: ALL / TEAM / OWN(+collaborator) ใช้กับ leads, appointments, commissions
- field-level: ซ่อน minPrice และข้อมูลติดต่อเจ้าของทรัพย์ เว้นแต่เป็น agent ผู้รับผิดชอบสินทรัพย์นั้นหรือบทบาทที่มีสิทธิ์; ปิดบังเบอร์ใน list (08x-xxx-1234)
- หน้าจัดการผู้ใช้, ทีม, บทบาท, สิทธิ์ (ตาราง checkbox) สำหรับ Admin

เกณฑ์เสร็จ: เทสต์ matrix ยิงทุก endpoint ด้วยผู้ใช้ 4 บทบาท และยืนยันว่า Agent A เปิด lead ของ Agent B ไม่ได้ (403) และไม่เห็น minPrice ของห้องที่ไม่ได้ดูแล
```

### P05 · Audit Log + ไฟล์

```text
1) AuditService: Prisma extension/interceptor ที่บันทึก actor, IP, entity, entityId, action (CREATE/UPDATE/ARCHIVE/APPROVE/TRANSFER/EXPORT/VIEW_SENSITIVE), before/after JSON อัตโนมัติ ทุก mutation ห้ามมีทางข้าม
2) component Timeline ใน apps/web แสดงประวัติในหน้ารายละเอียดของทุก entity
3) FileService: อัปโหลดไป S3 (bucket private), จำกัดชนิด (jpg, png, webp, pdf) และขนาด 15MB, ย่อรูปเป็น 3 ขนาด, ดาวน์โหลดผ่าน signed URL 5 นาที, ผูกไฟล์กับ entity แบบ polymorphic
4) การ archive ทุกที่ต้องผ่าน dialog ยืนยัน 2 ขั้น

เกณฑ์เสร็จ: เทสต์ยืนยันว่าแก้ asset แล้วมี audit row พร้อม diff ถูกต้อง และ UPDATE/DELETE audit_logs ตรงๆ ถูกฐานข้อมูลปฏิเสธ
```

## 5. Prompts Phase 2–3: CRM, สินทรัพย์ และงานเช่า/ขาย

### P06 · เจ้าของทรัพย์ + สินทรัพย์

```text
ทำโมดูล Owners และ Assets (API + หน้าจอหลังบ้าน) ตาม SRS ข้อ 2.1, 2.2 และ design ข้อ 7.1

- Owners: CRUD, สถานะ, agent ผู้ดูแล, ตรวจเบอร์/อีเมล/LINE ซ้ำก่อนบันทึก (แจ้งเตือน ไม่บล็อก)
- Assets: ฟอร์มเปลี่ยนฟิลด์ตาม asset_category (ใช้ zod schema จาก packages/shared), ownership_type OWNER/AGENT, ผูก owner และ project, Agent หลายคนต่อสินทรัพย์ผ่าน asset_agents พร้อมบทบาท
- อาพาร์ตเมนต์: สร้าง building แล้วเพิ่ม unit ทีละหลายห้อง (bulk)
- แกลเลอรีรูปลากเรียงลำดับได้ ใช้ FileService จาก P05
- listing_agreements: ประวัติสัญญาฝากเช่า/ฝากขาย + อัตราค่านายหน้าเริ่มต้น
- สถานะห้องแก้มือได้เฉพาะ "ไม่ว่าง" (ปิดชั่วคราว) สถานะอื่นมาจากเหตุการณ์ใน P11–P12

เกณฑ์เสร็จ: สร้างคอนโด, บ้าน, โรงงาน และอาพาร์ตเมนต์ 10 ห้องได้ครบจากหน้าจอ; ฟิลด์ที่ไม่ตรงประเภทถูก validate ปฏิเสธ; ทุกการแก้มี audit
```

### P07 · Lead + Lead Ownership

```text
ทำโมดูล Leads ตาม SRS ข้อ 2.3–2.4 และกฎ Lead Ownership ใน design ข้อ 5

- ฟอร์ม lead (รองรับทั้งผู้เช่าและผู้ซื้อ: intent RENT/BUY), แหล่งที่มา, งบ, ทำเล, ประเภททรัพย์ที่ต้องการ
- ก่อนบันทึกเรียก /leads/duplicates?phone=&line=&email= → ถ้าพบ แสดงผู้ดูแลและปุ่ม "ขอร่วมงาน" โดยไม่เปิดข้อมูลติดต่อ
- เจ้าของ = ผู้สร้าง; Manager โอนได้พร้อมเหตุผล → lead_assignments; คำขอร่วมงานต้องให้เจ้าของหรือ Manager อนุมัติ
- pipeline สถานะแบบ Kanban + ตาราง; ย้อน/ออกนอกเส้นทาง (Lost, ยกเลิก, ยังไม่ตัดสินใจ) ต้องใส่เหตุผล
- activities: บันทึกโทร/แชต/โน้ต พร้อมวันติดตามครั้งถัดไป, แสดงเป็นไทม์ไลน์
- job รายวัน: lead ไม่มีกิจกรรมเกิน [ใส่จำนวนวัน] วัน แจ้ง Manager

เกณฑ์เสร็จ: เทสต์ยืนยันเบอร์ 0812345678 กับ +66812345678 ถูกจับว่าซ้ำ, Agent ที่ไม่ใช่เจ้าของโอน lead ไม่ได้, ประวัติการโอนครบทุกครั้ง
```

### P08 · ค้นหา + นำเข้าข้อมูลเดิม

```text
1) Global search ที่ topbar: ค้นชื่อ, เบอร์ (บางส่วน), โครงการ, เลขห้อง ข้าม owners/assets/leads ด้วย pg_trgm เคารพ data scope ผลภายใน 300ms ที่ข้อมูล 50,000 แถว
2) สคริปต์ import จาก Excel/CSV (pnpm import:owners|assets|leads <file>): map คอลัมน์ผ่านไฟล์ config, normalize เบอร์, ผูกชื่อโครงการแบบ fuzzy, โหมด --dry-run ที่ออกรายงานแถวผิดและรายการซ้ำเป็น CSV ก่อนนำเข้าจริง

ตัวอย่างไฟล์ข้อมูลเดิมอยู่ที่ [ใส่ path ไฟล์ตัวอย่าง]
เกณฑ์เสร็จ: dry-run กับไฟล์ตัวอย่างได้รายงานถูกต้อง, import ซ้ำรอบสองไม่สร้างแถวซ้ำ (idempotent)
```

### P09 · จับคู่ห้อง

```text
ทำหน้า "จับคู่ห้อง" จากหน้า lead ตาม SRS ข้อ 3.1
- เติมเงื่อนไขจาก lead อัตโนมัติ (ทำเล, งบ, ประเภท, ขนาด, วันเข้าอยู่, ระยะเช่า, สัตว์เลี้ยง, intent เช่า/ขาย) แก้ได้
- แสดงเฉพาะสถานะว่าง/มีนัดดู เรียงตามความตรงเงื่อนไข พร้อมรูป ราคา ผู้ดูแล
- เลือกหลายห้องแล้ว "บันทึกเป็นห้องที่เสนอ" → lead_offers, และสร้างลิงก์แชร์ให้ลูกค้าดู (หน้า public ไม่มีข้อมูลภายใน หมดอายุ 7 วัน)
เกณฑ์เสร็จ: เทสต์ query ครบทุกเงื่อนไข และยืนยันว่าลิงก์แชร์ไม่มี minPrice/เลขห้อง/ข้อมูลเจ้าของ
```

### P10 · นัดดูห้อง

```text
ทำ Appointment Management ตาม SRS ข้อ 3.2
- สร้างนัด 1 ครั้งหลายห้อง (appointment_items) พร้อมเวลา สถานที่ agent ผู้พา ผู้ประสานงาน
- ตรวจนัดซ้อนของ agent คนเดียวกัน (tstzrange overlap) → เตือนและให้ยืนยันก่อนบันทึก
- ปฏิทินทีมด้วย FullCalendar (วัน/สัปดาห์/เดือน) กรองตาม agent/ทีม; Agent เห็นนัดคนอื่นเป็นแค่ "ไม่ว่าง"
- สถานะตาม design ข้อ 4; เลื่อนนัด = สร้างนัดใหม่ผูก rescheduledFrom
- เมื่อมีนัด สถานะห้องเป็น "มีนัดดู" อัตโนมัติ (ถ้ายังว่าง) และ lead เลื่อนเป็น "นัดดูห้อง"
เกณฑ์เสร็จ: เทสต์นัดซ้อน, การเลื่อนนัด, การเปลี่ยนสถานะห้อง/lead อัตโนมัติ; ปฏิทินใช้งานได้บนมือถือ
```

### P11 · ผลติดตาม + จอง

```text
1) เมื่อนัดเป็น "นัดสำเร็จ" บังคับบันทึกผลต่อห้อง (ชอบ, ต่อรอง, ขอดูห้องอื่น, รอพิจารณา, ไม่สนใจ, ตกลง) + วันติดตามครั้งถัดไป
2) Booking ตาม SRS ข้อ 3.4: ค่าเช่า, เงินจอง, เงินประกัน, ค่าเช่าล่วงหน้า, ช่วงสัญญา, ผู้รับเงิน, หลักฐาน
   - สถานะ รอชำระ → ชำระแล้ว → แปลงเป็นสัญญา / ยกเลิก (ระบุยึดหรือคืนเงินจอง)
   - ชำระแล้วจึงล็อกช่วงวันที่ ถ้าชน EXCLUDE constraint ให้แปลง error เป็นข้อความไทยที่บอกว่าชนกับการจองใด
   - ห้องเปลี่ยนเป็น "จองแล้ว", lead เป็น "จอง"
เกณฑ์เสร็จ: เทสต์ concurrency ยิงจองห้องเดียวกันช่วงเดียวกันพร้อมกัน 10 request สำเร็จได้ 1 เท่านั้น
```

### P12 · สัญญา + pipeline ขาย

```text
ทำสัญญาตาม SRS ข้อ 3.5–3.6 และ pipeline ขายตาม design ข้อ 7.1
- สัญญาเช่าแปลงจาก booking: เลขที่สัญญารันอัตโนมัติ [ใส่รูปแบบ เช่น LS-2026-0001], แนบไฟล์, สถานะลงนาม
- สัญญามีผลแล้วห้าม UPDATE: แก้ = revision, ต่อสัญญา = สัญญาใหม่ previousContractId, ยกเลิกก่อนกำหนดเก็บวันที่และเหตุผล
- สถานะห้องอัตโนมัติ: เซ็นแล้ว → ทำสัญญาแล้ว; สิ้นสุด/ยกเลิก → ว่าง (job รายวัน)
- ประวัติการเช่าต่อห้องและต่อลูกค้า เรียงตามเวลา
- งานขาย: deal สถานะ สนใจ → เสนอราคา → มัดจำ → สัญญาจะซื้อจะขาย → รออนุมัติสินเชื่อ → โอนกรรมสิทธิ์ → ปิดการขาย บันทึกราคาตกลง วันนัดโอน ค่าธรรมเนียมโอน (ใครจ่าย)
- เมื่อสัญญามีผลหรือขายปิด สร้าง commission สถานะ "รอคำนวณ" (ใช้ใน P14)
เกณฑ์เสร็จ: เทสต์ยืนยันว่าแก้สัญญาที่มีผลแล้วได้ revision ใหม่ ข้อมูลเดิมไม่เปลี่ยน และห้องกลับเป็นว่างหลังวันสิ้นสุด
```

## 6. Prompts Phase 4–5: เงิน รายงาน และแจ้งเตือน

### P13 · รับเงินและรายได้ห้อง Owner

```text
ทำโมดูลการเงินตาม SRS ข้อ 4.1
- payments: รับเงินทุกประเภท (เงินจอง, ประกัน, ค่าเช่าล่วงหน้า, ค่าเช่ารายเดือน, มัดจำซื้อ, รายรับอื่น) พร้อมวันที่ ช่องทาง ผู้รับ หลักฐาน
- rent_schedules: สร้างงวดค่าเช่ารายเดือนอัตโนมัติจากสัญญาห้อง OWNER, สถานะ ค้างชำระ/ชำระบางส่วน/ชำระแล้ว, ผูก payment กับงวด
- expenses: ค่าใช้จ่ายต่อสินทรัพย์ (ค่าส่วนกลาง, ซ่อม, ภาษี ฯลฯ) ตามหมวด [ใส่รายการหมวด]
- รายงานรายได้สุทธิต่อห้องต่อเดือน: ค่าเช่าที่รับจริง + รายรับอื่น − ค่านายหน้าที่จ่ายจริง − ค่าใช้จ่าย (cash basis)
เกณฑ์เสร็จ: เทสต์คำนวณรายได้สุทธิด้วยชุดข้อมูล 3 ห้อง 12 เดือนที่รู้คำตอบล่วงหน้า ตรงทุกสตางค์
```

### P14 · Commission engine (เขียนเทสต์ก่อน)

```text
สร้าง packages/commission เป็น pure TypeScript ไม่พึ่ง DB ตาม design ข้อ 6

ขั้นที่ 1 เขียนเทสต์ก่อนและให้ฉันรีวิวก่อนเขียนโค้ดจริง:
- สูตร ONE_MONTH, PERCENT_TOTAL, N_MONTHS (ทศนิยมได้), FIXED, CUSTOM, PERCENT_SALE_PRICE
- การแบ่งตามบทบาท FINDER, LISTING, SHOWING, CLOSER, COMPANY แบบ % หรือจำนวนเงิน คนเดียวหลายบทบาทได้
- validate: % รวมต้อง = 100; จำนวนเงินรวมต้อง ≤ ยอดรวม (ส่วนต่างเข้า COMPANY); ไม่ผ่านให้คืน error รายการ
- ปัดเศษเป็นสตางค์ ปัดลงทุกแถว เศษเข้า COMPANY ผลรวมต้องเท่ายอดรวมเสมอ
- เคสจาก SRS: ยอด 30,000 แบ่ง 30/20/30/20 = 9,000/6,000/9,000/6,000
- property-based test (fast-check): ทุกอินพุตที่ถูกต้อง ผลรวมส่วนแบ่ง = ยอดรวมพอดี
- ภาษีหัก ณ ที่จ่าย: [ใส่กฎที่ฝ่ายบัญชีตัดสิน เช่น หัก 3% เฉพาะ agent ฟรีแลนซ์]

ขั้นที่ 2 หลังฉันอนุมัติเทสต์: เขียนโค้ดให้เทสต์ผ่านทั้งหมด ไม่แก้เทสต์เพื่อให้ผ่าน
เกณฑ์เสร็จ: coverage ≥ 95% และเคส 20 ดีลจริงใน docs/commission-cases.csv คำนวณตรงทุกแถว
```

### P15 · อนุมัติและจ่ายค่านายหน้า

```text
ต่อ packages/commission เข้ากับ API และหน้าจอ ตาม SRS ข้อ 4.2–4.4
- หน้า commission ของสัญญา/ดีล: เลือกสูตร (ค่าเริ่มต้นจาก listing_agreement), ระบบเติมรายชื่อ agent ตามบทบาทจาก lead/asset, ใช้เทมเพลตการแบ่ง, แสดงผล validate สดก่อนบันทึก
- workflow สถานะตาม design ข้อ 4 (ห้อง OWNER ข้ามขั้นรอรับเงินจากเจ้าของ) ผู้มีสิทธิ์แต่ละขั้นตาม RBAC
- อนุมัติแล้ว snapshot ลง commission_revisions; แก้หลังอนุมัติ = revision ใหม่ + เหตุผล + ต้องอนุมัติใหม่
- บันทึกรับเงินจากเจ้าของทรัพย์และจ่าย agent (payout) พร้อมหลักฐาน รองรับจ่ายเป็นรอบ (เช่น ทุกวันที่ [ใส่วันที่]) รวมหลายดีล
- Agent เห็นเฉพาะส่วนแบ่งของตัวเอง
เกณฑ์เสร็จ: E2E เดินครบจากรอคำนวณถึงจ่ายแล้ว และเทสต์ยืนยันว่ายอดที่อนุมัติแล้วไม่ถูกเปลี่ยนโดยไม่มี revision
```

### P16 · Dashboard + รายงาน

```text
ทำ Dashboard และรายงานตาม SRS ข้อ 4.5 และ 5
- Dashboard ผู้บริหาร: จำนวนสินทรัพย์ตามสถานะ, lead ใหม่, นัดดู, ดีลปิด, อัตราปิด (funnel), รายได้ Owner, ค่านายหน้า, ส่วนแบ่ง agent, รายได้สุทธิบริษัท, ค้างรับ/ค้างจ่าย; ตัวกรองช่วงเวลา ทีม โครงการ ประเภทสินทรัพย์ เช่า/ขาย
- รายงาน: รายวัน/เดือน/ปี, ตาม Owner/Agent, โครงการ, agent รายบุคคล, ตามสัญญา; Export Excel และ CSV (stream) ตามสิทธิ์ และบันทึก audit EXPORT
- ทุกตัวเลขมาจาก SQL view/query เดียวกันระหว่าง Dashboard และรายงาน
เกณฑ์เสร็จ: เทสต์ reconciliation ยืนยันว่ายอดใน Dashboard = ผลรวมรายการธุรกรรมจาก seed ทุกตัวกรอง; โหลด Dashboard < 2 วินาทีที่ข้อมูล 1 ปี
```

### P17 · แจ้งเตือน

```text
ทำระบบแจ้งเตือนตาม design ข้อ 7 (ตารางเหตุการณ์ ผู้รับ เวลาส่ง)
- notification_rules ใน DB แก้ได้จากหน้า Admin; event bus ภายใน (EventEmitter) → BullMQ job
- ช่องทาง: in-app (กระดิ่ง + หน้ารวม, real-time ด้วย SSE), Email (SMTP/SES), LINE Official Account Messaging API (push message)
- ผู้ใช้ผูก LINE ผ่าน LINE Login ในหน้าโปรไฟล์ และเลือกช่องทางต่อประเภทแจ้งเตือนได้
- job ตั้งเวลา: เตือนนัด 1 วัน/2 ชม.ก่อน, ติดตามเลยกำหนด, สัญญาเหลือ 90/60/30 วัน, ครบกำหนดรับ/จ่ายค่านายหน้า, สรุปรายการรออนุมัติรายวัน
- retry 3 ครั้ง, กันส่งซ้ำด้วย idempotency key
ค่า channel token: ใส่ใน .env (LINE_CHANNEL_ACCESS_TOKEN ฯลฯ) ห้าม hardcode
เกณฑ์เสร็จ: เทสต์ที่ใช้ fake clock ยืนยันว่าแต่ละกฎส่งถึงผู้รับถูกคน ถูกเวลา และไม่ส่งซ้ำ
```

## 7. Prompts Phase 6–7: ส่งมอบและ Public Portal

### P18 · E2E ตาม Acceptance Criteria

```text
เขียน Playwright E2E ให้ครบเกณฑ์ตรวจรับใน SRS ข้อ 9 ทีละข้อ (1 ข้อ = อย่างน้อย 1 spec ตั้งชื่อตามข้อ)
- เส้นทางหลัก: lead → จับคู่ → นัดหลายห้อง → ผลติดตาม → จอง → สัญญา → ค่านายหน้า → อนุมัติ → จ่าย ทั้งห้อง OWNER และ AGENT และดีลขาย 1 เส้น
- สิทธิ์: ล็อกอิน 4 บทบาท ยืนยันว่าเห็นเฉพาะข้อมูลตามสิทธิ์
- กรณีผิดพลาด: lead ซ้ำ, นัดซ้อน, จองซ้ำ, ส่วนแบ่งไม่ครบ 100%, แก้ค่านายหน้าหลังอนุมัติ
- รันทั้ง desktop (1440px) และมือถือ (390px) ใน CI
ส่งมอบ docs/uat-checklist.md ภาษาไทย ให้ผู้ใช้จริงทดสอบด้วยมือ ข้อละ: ขั้นตอน, ผลที่คาด, ช่องผ่าน/ไม่ผ่าน
เกณฑ์เสร็จ: E2E ทั้งหมดเขียวใน CI 3 รอบติดกัน (ไม่ flaky)
```

### P19 · ย้ายข้อมูล, Backup, คู่มือ

```text
1) runbook docs/go-live.md: ลำดับขั้นย้ายข้อมูลจริงด้วยสคริปต์จาก P08, ตรวจยอดหลังนำเข้า, แผนถอยกลับ
2) Backup: ตั้ง backup รายวัน + PITR 14 วัน [ใส่ผู้ให้บริการ DB], สคริปต์ทดสอบกู้คืนลงฐานแยกแล้วตรวจจำนวนแถวสำคัญ, เอกสารขั้นตอนกู้คืน
3) docs/api.md จาก Swagger และ docs/database.md จาก Prisma schema
4) คู่มือผู้ใช้ภาษาไทยแยกตามบทบาท (Admin, Manager, Agent, Accounting) เป็น Markdown พร้อมจุดใส่ภาพหน้าจอ เขียนจากหน้าจอจริงในโค้ด ไม่แต่งฟีเจอร์ที่ไม่มี
เกณฑ์เสร็จ: ทดสอบกู้คืนบน staging สำเร็จและบันทึกเวลาที่ใช้
```

### P20 · Listings + public API

```text
ทำส่วนหลังบ้านของ Public Portal ตาม design ข้อ 7.1
- listings: ผูก asset, ประเภท RENT/SALE, ราคา, หัวข้อ/รายละเอียด TH/EN, slug, วันหมดอายุ; สถานะ ร่าง → รออนุมัติ → เผยแพร่ → ปิด; Manager อนุมัติ
- ปิดประกาศอัตโนมัติเมื่อสินทรัพย์จอง/ทำสัญญา/ขายแล้ว และเปิดใหม่เมื่อว่าง (ต้องอนุมัติซ้ำหรือไม่: [ใส่])
- public API (ไม่ต้องล็อกอิน, read-only): ค้นหา + กรอง + แบ่งหน้า, รายละเอียดตาม slug, ประกาศใกล้เคียง; ส่งเฉพาะฟิลด์ public (ห้าม minPrice, เลขห้อง/บ้านเลขที่, เจ้าของ, หมายเหตุภายใน) โดยใช้ DTO whitelist
- cache response + rate limit
เกณฑ์เสร็จ: contract test ยืนยันว่า response public ไม่มีฟิลด์ต้องห้ามแม้แต่ฟิลด์เดียว
```

### P21 · หน้าเว็บ Portal

```text
สร้าง apps/portal ด้วย Next.js (SSR/ISR) เรียก public API จาก P20
- หน้าแรก, หน้าค้นหา (ตัวกรอง: ประเภทสินทรัพย์, เช่า/ขาย, ทำเล + แผนที่, ราคา, ขนาด, ห้องนอน, สัตว์เลี้ยง), หน้ารายละเอียด (แกลเลอรี, แผนที่, ฟิลด์ตามประเภท, ประกาศใกล้เคียง), รายการโปรด/เปรียบเทียบ (localStorage)
- ภาษาไทย/อังกฤษ (/th, /en), SEO: metadata ต่อหน้า, sitemap.xml, schema.org (Product/Offer, RealEstateListing), Open Graph
- ดีไซน์: [ใส่แบรนด์/สี/โลโก้ หรือแนบไฟล์ดีไซน์], mobile-first
- next/image ผ่าน CDN, Lighthouse มือถือ ≥ 90 ทั้ง Performance และ SEO
- cookie banner + หน้านโยบายความเป็นส่วนตัว (PDPA)
เกณฑ์เสร็จ: E2E ค้นหา → เปิดประกาศ ผ่านทั้ง 2 ภาษา และรายงาน Lighthouse แนบใน PR
```

### P22 · ฟอร์มจากเว็บ → CRM

```text
เชื่อมฟอร์มบน Portal เข้าระบบหลังบ้าน
- ฟอร์มสอบถาม และขอนัดดู (เลือกวันเวลาที่สะดวก) → สร้างหรือผูก lead (ใช้ตรวจซ้ำจาก P07) source=WEBSITE, ผูก listing; ขอนัด → appointment สถานะ "รอยืนยัน" ให้ agent ผู้ดูแลประกาศ
- ฟอร์มฝากขาย/ฝากเช่า → owner สถานะลูกค้าใหม่ + รูปที่อัปโหลด (จำกัดชนิดและขนาด)
- checkbox ยินยอม PDPA บังคับ เก็บข้อความและเวลาที่ยินยอม
- CAPTCHA (Cloudflare Turnstile) + rate limit + honeypot กันสแปม
- ส่งแจ้งเตือนผ่าน P17 ถึง agent/Manager ทันที; ลูกค้าได้อีเมลยืนยัน
- ปุ่ม LINE/โทรติด UTM/รหัสประกาศ เพื่อวัดว่าประกาศไหนสร้าง lead
เกณฑ์เสร็จ: E2E ส่งฟอร์มแล้ว lead และนัดโผล่ในหลังบ้านพร้อมแจ้งเตือน; ส่งซ้ำด้วยเบอร์เดิมไม่สร้าง lead ใหม่
```

## 8. Prompt แม่แบบใช้ซ้ำ

ใช้ระหว่างทุก phase ควรเปิด session ใหม่สำหรับการรีวิว เพื่อให้ AI ไม่ตรวจงานที่ตัวเองเพิ่งเขียนด้วยมุมมองเดิม

### R1 · รีวิวโค้ดก่อน merge

```text
รีวิว diff ของ branch นี้เทียบกับ main แบบผู้ตรวจที่เข้มงวด ห้ามแก้โค้ด รายงานอย่างเดียว
ตรวจตามลำดับ:
1) ละเมิดกฎใน CLAUDE.md ข้อใดบ้าง (เงิน, archive, audit, สิทธิ์, revision, เบอร์, i18n)
2) endpoint ไหนไม่มี PermissionGuard หรือ data scope หรือส่งฟิลด์ลับออกไป
3) บั๊กเชิงตรรกะ, race condition, N+1 query, ขาด transaction
4) เทสต์ที่ขาด: กรณีขอบและกรณีผิดพลาด
5) ตรงกับเกณฑ์เสร็จของ prompt [ใส่เลข prompt] ครบหรือไม่
ตอบเป็นตาราง: ระดับ (ต้องแก้/ควรแก้/เล็กน้อย), ไฟล์:บรรทัด, ปัญหา, วิธีแก้
```

### R2 · แก้บั๊ก

```text
บั๊ก: [อาการที่เห็น]
ขั้นตอนทำซ้ำ: [1, 2, 3]
ผลที่คาด: [...] ผลจริง: [...] ผู้ใช้/บทบาท: [...]

ขั้นตอน: (1) เขียนเทสต์ที่ fail ซ้ำอาการนี้ก่อน (2) หาสาเหตุราก อธิบายสั้นๆ (3) แก้ให้เทสต์ผ่านโดยไม่ทำเทสต์อื่นพัง (4) ค้นหาจุดอื่นในโค้ดที่มีรูปแบบเดียวกันและรายงาน
```

### R3 · เพิ่มหรือเปลี่ยนกฎธุรกิจ

```text
กฎใหม่จากเจ้าของงาน: [ข้อความกฎ]
1) บันทึกลง docs/decisions.md พร้อมวันที่
2) วิเคราะห์ผลกระทบ: ตาราง/migration, API, หน้าจอ, เทสต์, ข้อมูลเดิมที่ต้องแปลง
3) เสนอแผนให้ฉันอนุมัติก่อนลงมือ ถ้ามีข้อมูลเดิมกระทบ ต้องมี migration ที่ย้อนกลับได้
```

### R4 · ตรวจความครบตามสเปก

```text
เทียบโค้ดปัจจุบันกับ docs/srs.md และ docs/design.md ทีละข้อ
ทำตาราง: ข้อในสเปก, สถานะ (ครบ/บางส่วน/ยังไม่ทำ), ไฟล์ที่เกี่ยวข้อง, สิ่งที่ขาด
แล้วเสนอ prompt ถัดไปที่ควรทำเพื่อปิดช่องว่างที่สำคัญที่สุด 3 อันดับ
```
