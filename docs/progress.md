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
| P08 | ค้นหา + นำเข้าข้อมูลเดิม | ยังไม่เริ่ม | | |
| P09 | จับคู่ห้อง | ยังไม่เริ่ม | | |
| P10 | นัดดูห้อง | ยังไม่เริ่ม | | |
| P11 | ผลติดตาม + จอง | ยังไม่เริ่ม | | |
| P12 | สัญญา + pipeline ขาย | ยังไม่เริ่ม | | |
| P13 | รับเงินและรายได้ห้อง Owner | ยังไม่เริ่ม | | |
| P14 | Commission engine | ยังไม่เริ่ม | | |
| P15 | อนุมัติและจ่ายค่านายหน้า | ยังไม่เริ่ม | | |
| P16 | Dashboard + รายงาน | ยังไม่เริ่ม | | |
| P17 | แจ้งเตือน | ยังไม่เริ่ม | | |
| P18 | E2E ตาม Acceptance Criteria | ยังไม่เริ่ม | | |
| P19 | ย้ายข้อมูล, Backup, คู่มือ | ยังไม่เริ่ม | | |
| P20 | Listings + public API | ยังไม่เริ่ม | | |
| P21 | หน้าเว็บ Portal | ยังไม่เริ่ม | | |
| P22 | ฟอร์มจากเว็บ → CRM | ยังไม่เริ่ม | | |
