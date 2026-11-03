# ความคืบหน้า

อัปเดตทุกครั้งที่ prompt เสร็จ (AI ทำให้ได้ตามกติกาใน CLAUDE.md)

| Prompt | งาน | สถานะ | PR | หมายเหตุ |
| --- | --- | --- | --- | --- |
| P01 | ERD + Prisma schema + seed | เสร็จ 2026-10-19 | – | 34 ตาราง, 2 migration, 29 เทสต์ DB + 17 เทสต์ shared ผ่านบน PostgreSQL 16; ใช้สมมติฐาน D01–D04, D07, D09, D10, D12 |
| P02 | ตั้ง monorepo, Docker, CI, staging | เสร็จ 2026-10-19 (ยกเว้น deploy staging) | – | Turborepo, API NestJS (/health, Swagger, log, error ภาษาไทย), หลังบ้าน Next.js (เมนู, มือถือ), Portal TH/EN, CI GitHub Actions; 69 เทสต์ + E2E 2 จอ ผ่าน; deploy staging รอเลือก hosting |
| P03 | Auth: login, JWT, 2FA | เสร็จ 2026-10-19 | – | Argon2id, access JWT 15 นาที + refresh cookie หมุนเวียน (จับ token ถูกขโมย), ล็อก 15 นาทีหลังผิด 5 ครั้ง, 2FA บังคับ Admin/Accounting, ลืมรหัสผ่าน 30 นาที, audit ล็อกอิน; หน้า login/2FA/ลืมรหัส; เทสต์ API 22 + web 10 + E2E 8 |
| P04 | RBAC + data scope | เสร็จ 2026-10-26 | `feat/p04-rbac` | PermissionGuard + @Can, DataScopeService (ALL/TEAM/OWN 7 เอนทิตี), ซ่อน minPrice/ข้อมูลติดต่อเจ้าของ + mask เบอร์โทร, หน้าตั้งค่าผู้ใช้/ทีม/บทบาทและสิทธิ์ + รีเซ็ต 2FA; ตัดสินใจ D15–D16; เทสต์รวม 117 + E2E 10 ผ่าน |
| P05 | Audit Log + ไฟล์ | เสร็จ 2026-10-27 | `feat/p05-audit-files` | Prisma Client Extension บันทึก audit_logs อัตโนมัติพร้อม AsyncLocalStorage (actor, IP, UA, before/after), FileService (S3/MinIO, sharp ย่อ 3 ขนาด WebP, signed URL 5 นาที), คอมโพเนนต์ `<Timeline />` และ `<ConfirmArchiveDialog />` (ยืนยัน 2 ขั้นตอน) |
| P06 | เจ้าของทรัพย์ + สินทรัพย์ | เสร็จ 2026-10-27 | `feat/p06-owners-assets` | Owners CRUD + เตือนเบอร์/LINE/อีเมลซ้ำ, Assets 9 ประเภท (validate ด้วย assetAttributesSchemas), อพาร์ตเมนต์ Bulk Units, ผู้ดูแลหลายบทบาท, แกลเลอรีรูปเรียงลำดับ, ประวัติสัญญาฝากเช่า/ขาย, TanStack Table + มือถือ |
| P07 | Lead + Lead Ownership | เสร็จ 2026-10-28 | `feat/p07-leads` | Lead เช่า/ซื้อ, ตรวจเบอร์ซ้ำด้วย normalizePhone ไม่รั่วไหลข้อมูลติดต่อ + ปุ่มขอร่วมงาน, โอนผู้ดูแลเฉพาะ Manager พร้อมบันทึก lead_assignments + audit TRANSFER, Kanban + Table บังคับใส่เหตุผลเมื่อย้อนสถานะ/LOST, บันทึก activities และแจ้งเตือนค้างเกิน 30 วัน |
| P08 | ค้นหา + นำเข้าข้อมูลเดิม | เสร็จ 2026-10-28 | `feat/p08-search-import` | Global search ข้าม owners/assets/leads ด้วย pg_trgm เคารพ data scope ภายใน 300ms, คอมโพเนนต์ `<GlobalSearchBar />` บน topbar, สคริปต์ import CSV (`pnpm import:owners\|assets\|leads`) รองรับ map คอลัมน์, normalizePhone, ผูกโครงการแบบ fuzzy, `--dry-run` ออกรายงาน CSV, และ idempotent |
| P09 | จับคู่ห้อง | เสร็จ 2026-11-02 | `feat/p09-matching` | MatchingService ดึงเงื่อนไขจาก Lead อัตโนมัติ คัดเฉพาะห้องว่างเรียงตาม matchScore, บันทึก lead_offers หลายห้องพร้อมสร้างลิงก์แชร์อายุ 7 วัน, หน้า `/share/[token]` สำหรับลูกค้าโดยไม่มี minPrice/เลขห้อง/ข้อมูลเจ้าของ |
| P10 | นัดดูห้อง | เสร็จ 2026-11-02 | `feat/p10-appointments` | AssetStatusService.recompute(assetId), สร้างนัดหลายห้อง (appointment_items), ตรวจนัดซ้อนด้วย tstzrange overlap พร้อมเตือนให้ยืนยันก่อนบันทึก, เลื่อนนัดผูก rescheduledFromId, เปลี่ยนสถานะห้อง/Lead อัตโนมัติ, ปฏิทินทีม วัน/สัปดาห์/เดือน ที่ Agent เห็นนัดคนอื่นเป็น "ไม่ว่าง" |
| P11 | ผลติดตาม + จอง | เสร็จ 2026-11-02 | `feat/p11-followup-booking` | บังคับบันทึกผลต่อห้อง + วันติดตามถัดไปเมื่อนัดเป็น COMPLETED, สร้าง/รับชำระ/ยกเลิก Booking (ยึดหรือคืนเงินจอง), ล็อกช่วงวันที่ด้วย PostgreSQL EXCLUDE constraint พร้อมแปลง error เป็นข้อความไทยระบุรหัสที่ชนกัน, เทสต์ concurrency 10 requests ผ่าน |
| P12 | สัญญา + pipeline ขาย | เสร็จ 2026-11-02 | `feat/p12-contracts-sales` | แปลง Booking เป็นสัญญาเช่า (LS-YYYY-NNNN), ลงนามเปลี่ยนห้องเป็น CONTRACTED + สร้าง Commission รอคำนวณ, แก้สัญญา ACTIVE ได้แถวใหม่ Revision+1 (-R2) เดิมเป็น SUPERSEDED, ต่อสัญญาผูก previousContractId, Job รายวันคืนห้องว่างหลังวันสิ้นสุด, Pipeline งานขาย 7 สถานะเปลี่ยนห้องเป็น SOLD |
| P13 | รับเงินและรายได้ห้อง Owner | เสร็จ 2026-11-03 | `feat/p13-owner-finance` | คำนวณเงินหน่วยสตางค์ (BigInt satang) ห้ามใช้ float, รับ/จ่ายเงินทุกประเภทพร้อมหลักฐานและ audit, สร้าง rent_schedules รายเดือนอัตโนมัติเมื่อสัญญาห้อง OWNER เป็น ACTIVE และตัดยอด DUE → PARTIAL → PAID, บันทึก expenses ตามหมวด, รายงานรายได้สุทธิ Cash Basis ทดสอบ 3 ห้อง × 12 เดือนตรงทุกสตางค์ |
| P14 | Commission engine | เสร็จ 2026-11-03 | `feat/p14-commission-engine` | แพ็กเกจ `@rrs/commission` pure TypeScript คำนวณหน่วยสตางค์ (BigInt) ครบ 6 สูตร (`ONE_MONTH`, `PERCENT_TOTAL`, `N_MONTHS`, `FIXED`, `CUSTOM`, `PERCENT_SALE_PRICE`), แบ่งตามบทบาท `%` และ `AMOUNT`, ปัดลงทุกแถวเศษเข้า `COMPANY`, หักภาษี ณ ที่จ่าย 3% ฟรีแลนซ์, property-based test (`fast-check`) + ชุดทดสอบ 20 ดีลจริงใน `docs/commission-cases.csv` ผ่านครบ Coverage 95.55% |
| P15 | อนุมัติและจ่ายค่านายหน้า | เสร็จ 2026-11-03 | `feat/p15-commission-workflow` | เชื่อม `@rrs/commission` กับ API (`CommissionsModule`) และหน้า `/commissions`, ใช้เทมเพลต 30/20/30/20 เติมชื่อ Agent อัตโนมัติ + validate สดก่อนบันทึก, อนุมัติแล้ว snapshot ลง `commission_revisions` (แก้หลังอนุมัติต้องมีเหตุผล สร้าง revision ใหม่ ไม่ทับฉบับเดิม), ห้อง OWNER ข้ามขั้นรับเงินเจ้าของ, บันทึกรับเงินเจ้าของและจ่าย Payout เป็นรอบรวมหลายดีล, Agent เห็นเฉพาะส่วนของตัวเอง |
| P16 | Dashboard + รายงาน | ยังไม่เริ่ม | | |
| P17 | แจ้งเตือน | ยังไม่เริ่ม | | |
| P18 | E2E ตาม Acceptance Criteria | ยังไม่เริ่ม | | |
| P19 | ย้ายข้อมูล, Backup, คู่มือ | ยังไม่เริ่ม | | |
| P20 | Listings + public API | ยังไม่เริ่ม | | |
| P21 | หน้าเว็บ Portal | ยังไม่เริ่ม | | |
| P22 | ฟอร์มจากเว็บ → CRM | ยังไม่เริ่ม | | |
