# เอกสารโครงสร้างฐานข้อมูล (Database Schema Reference)

ฐานข้อมูลระบบ RRS ใช้ **PostgreSQL 16** พร้อมส่วนขยาย `pg_trgm` (ค้นหาข้อความใกล้เคียง) และ `btree_gist` (ป้องกันการจอง/สัญญาทับช่วงเวลา) โดยจัดการผ่าน `@rrs/db` (`packages/db/prisma/schema.prisma`)

---

## 1. กฎและข้อบังคับระดับฐานข้อมูล (Database Constraints & Triggers)

1. **หน่วยเงินทั้งหมดใช้ `DECIMAL(14, 2)`** และคำนวณในโค้ดด้วยหน่วยสตางค์ (`BigInt`) ห้ามใช้ `FLOAT`
2. **ห้ามลบข้อมูลหลักจริง (Soft Archive)**: ใช้คอลัมน์ `archived_at` และ `archived_by_id`
3. **ป้องกันจองหรือสัญญาทับช่วงเวลาเดียวกันในห้องเดิม (`EXCLUDE USING gist`)**:
   - `bookings_no_overlap`: ห้ามมีใบจองสถานะ `PAID` หรือ `CONVERTED` ของ `asset_id` เดียวกันที่ `daterange(start_date, end_date, '[]')` ทับซ้อนกัน
   - `contracts_no_overlap`: ห้ามมีสัญญาเช่าสถานะ `ACTIVE` ของ `asset_id` เดียวกันที่ช่วงวันทับซ้อนกัน
4. **ตาราง `audit_logs` เป็น Append-Only 100%**:
   - Trigger `audit_logs_no_update_delete` และ `audit_logs_no_truncate` ปฏิเสธคำสั่ง `UPDATE`, `DELETE`, และ `TRUNCATE` ในระดับ PostgreSQL

---

## 2. รายชื่อตารางทั้งหมดแยกตามหมวดหมู่ (34 ตาราง)

### 2.1 ผู้ใช้งาน ทีม บทบาท และการยืนยันตัวตน
| ตารางใน DB | โมเดล Prisma | คำอธิบาย |
| --- | --- | --- |
| `users` | `User` | ผู้ใช้งานระบบ (`is_freelance`, `totp_secret`, `line_user_id`, `notification_prefs`) |
| `teams` | `Team` | ทีมขาย/เช่า และผู้จัดการทีม (`manager_id`) |
| `roles` | `Role` | บทบาท (`ADMIN`, `MANAGER`, `AGENT`, `ACCOUNTING` และบทบาทที่สร้างเพิ่ม) |
| `permissions` | `Permission` | สิทธิ์รายโมดูล (`<module>.<action>`) |
| `role_permissions` | `RolePermission` | การผูกสิทธิ์เข้ากับบทบาทพร้อมขอบเขตข้อมูล (`ALL`, `TEAM`, `OWN`) |
| `user_roles` | `UserRole` | การผูกผู้ใช้งานเข้ากับบทบาท |
| `refresh_tokens` | `RefreshToken` | Refresh Token แบบหมุนเวียนตาม `family_id` (เก็บเฉพาะ SHA-256 hash) |
| `password_reset_tokens` | `PasswordResetToken` | โทเคนรีเซ็ตรหัสผ่านใช้ครั้งเดียว อายุ 30 นาที |

### 2.2 เจ้าของทรัพย์ โครงการ อาคาร สินทรัพย์ และประกาศ
| ตารางใน DB | โมเดล Prisma | คำอธิบาย |
| --- | --- | --- |
| `owners` | `Owner` | เจ้าของทรัพย์ (`OW-xxxxxx`, เบอร์โทร `E.164`, `is_company`) |
| `projects` | `Project` | โครงการอสังหาริมทรัพย์ พิกัด และสถานีรถไฟฟ้าใกล้เคียง |
| `buildings` | `Building` | อาคารอพาร์ตเมนต์/หอพักที่มีหลายยูนิต |
| `assets` | `Asset` | สินทรัพย์ทั้ง 9 ประเภท (`PR-xxxxxx`, แยก `OWNER` / `AGENT`, `attributes` JSONB) |
| `asset_agents` | `AssetAgent` | ผู้ดูแลสินทรัพย์หลายคนต่อห้อง (`LISTING`, `CO_AGENT`) |
| `asset_media` | `AssetMedia` | รูปภาพและสื่อของสินทรัพย์เรียงตาม `sort_order` |
| `listing_agreements` | `ListingAgreement` | ประวัติสัญญาฝากเช่า/ฝากขายและสูตรค่านายหน้า |
| `listings` | `Listing` | ประกาศบนหน้าเว็บ Portal สาธารณะ (`DRAFT`, `PENDING_APPROVAL`, `PUBLISHED`, `CLOSED`) |

### 2.3 ลูกค้า (Lead / CRM) และการนัดดูห้อง
| ตารางใน DB | โมเดล Prisma | คำอธิบาย |
| --- | --- | --- |
| `leads` | `Lead` | ลูกค้าเช่า/ซื้อ (`LD-xxxxxx`), ผู้รับผิดชอบหลัก (`owner_agent_id`), และความยินยอม PDPA |
| `lead_assignments` | `LeadAssignment` | ประวัติการโอนผู้ดูแลลูกค้า (สร้างแถวใหม่ทุกครั้ง) |
| `lead_collaborators` | `LeadCollaborator` | ผู้ร่วมงานในดีลของลูกค้า (`FINDER`, `LISTING`, `SHOWING`, `CLOSER`) |
| `activities` | `Activity` | ประวัติการติดต่อ โน้ต และผลการติดตาม |
| `lead_offers` | `LeadOffer` | ห้องที่เสนอให้ลูกค้าพร้อมลิงก์แชร์ (`share_token` อายุ 7 วัน) |
| `appointments` | `Appointment` | นัดหมายดูห้อง (`AP-xxxxxx`) พร้อมตรวจเวลาซ้อน (`tstzrange`) |
| `appointment_items` | `AppointmentItem` | รายการห้องในนัดหมาย 1 ครั้ง และผลติดตามรายห้อง (`outcome`) |

### 2.4 การจอง สัญญาเช่า ดีลขาย การเงิน และค่านายหน้า
| ตารางใน DB | โมเดล Prisma | คำอธิบาย |
| --- | --- | --- |
| `bookings` | `Booking` | ใบจองห้อง (`BK-xxxxxx`) และสถานะเงินจอง |
| `contracts` | `Contract` | สัญญาเช่า (`LS-YYYY-NNNN`) รองรับ Revision และต่อสัญญา (`previous_contract_id`) |
| `contract_parties` | `ContractParty` | คู่สัญญา/ผู้เช่า/ผู้ค้ำประกัน |
| `sale_deals` | `SaleDeal` | ดีลงานขาย (`SD-xxxxxx`) 7 สถานะตั้งแต่สนใจจนถึงโอนกรรมสิทธิ์ |
| `payments` | `Payment` | รายการรับ/จ่ายเงินทุกประเภทพร้อมหลักฐาน |
| `rent_schedules` | `RentSchedule` | ตารางงวดค่าเช่ารายเดือนของห้องประเภท `OWNER` |
| `expenses` | `Expense` | ค่าใช้จ่ายของสินทรัพย์ (`COMMON_FEE`, `REPAIR`, `UTILITY`, ฯลฯ) |
| `commissions` | `Commission` | รายการคำนวณค่านายหน้าต่อสัญญาเช่าหรือดีลขาย |
| `commission_splits` | `CommissionSplit` | ส่วนแบ่งค่านายหน้ารายบทบาทและภาษีหัก ณ ที่จ่าย |
| `commission_revisions` | `CommissionRevision` | Snapshot ประวัติการอนุมัติและแก้ไขค่านายหน้า |
| `commission_payouts` | `CommissionPayout` | รอบการจ่ายเงินส่วนแบ่งค่านายหน้าให้ Agent |

### 2.5 ระบบส่วนกลาง ไฟล์ แจ้งเตือน และ Audit
| ตารางใน DB | โมเดล Prisma | คำอธิบาย |
| --- | --- | --- |
| `files` | `File` | เมทาดาทาไฟล์ใน S3/MinIO ผูกกับเอนทิตีแบบ Polymorphic |
| `notifications` | `Notification` | รายการแจ้งเตือนรายผู้ใช้และสถานะการส่งต่อช่องทาง |
| `notification_rules` | `NotificationRule` | กฎการแจ้งเตือนที่ตั้งค่าได้จากหน้า Admin |
| `audit_logs` | `AuditLog` | ประวัติการกระทำทั้งหมดในระบบแบบ Append-Only |
| `code_sequences` | `CodeSequence` | ตัวนับรหัสอัตโนมัติแบบ Atomic (`nextCode()`) |
