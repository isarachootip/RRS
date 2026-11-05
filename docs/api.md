# เอกสารอ้างอิง REST API (API Reference)

ระบบหลังบ้าน RRS ให้บริการ REST API ภายใต้คำนำหน้า `/api/v1` (ยกเว้น `/health`) พร้อมเอกสาร OpenAPI / Swagger UI ที่ `/api/docs` และไฟล์สเปกใน `docs/openapi.json`

---

## 1. มาตรฐานการเรียกใช้งานและรูปแบบข้อความผิดพลาด

- **การยืนยันตัวตน**: ส่ง Header `Authorization: Bearer <accessToken>` (อายุ 15 นาที) และคุกกี้ `rrs_rt` (`HttpOnly`) สำหรับต่ออายุที่ `POST /api/v1/auth/refresh`
- **รูปแบบข้อความผิดพลาดมาตรฐาน**:
  ```json
  {
    "code": "BOOKING_DATE_OVERLAP",
    "message": "ห้องนี้มีการจองหรือสัญญาเช่าในช่วงวันที่เลือกแล้ว",
    "details": {},
    "requestId": "req-uuid"
  }
  ```

---

## 2. สรุป Endpoint แยกตามโมดูล

### 2.1 ระบบยืนยันตัวตน สิทธิ์ และผู้ใช้งาน (`Auth & RBAC`)
| Method & Path | สิทธิ์ขั้นต่ำ | คำอธิบาย |
| --- | --- | --- |
| `POST /api/v1/auth/login` | Public | เข้าสู่ระบบด้วยอีเมลและรหัสผ่าน (จำกัดอัตรา 5 ครั้ง/นาที/IP) |
| `POST /api/v1/auth/mfa/setup` | Challenge Token | ขอ Secret และ QR Code สำหรับตั้งค่า 2FA (TOTP) |
| `POST /api/v1/auth/mfa/enable` | Challenge Token | ยืนยันรหัส 6 หลักเพื่อเปิดใช้งาน 2FA ครั้งแรก |
| `POST /api/v1/auth/mfa/verify` | Challenge Token | ยืนยันรหัส 2FA ตอนเข้าสู่ระบบ |
| `POST /api/v1/auth/refresh` | Refresh Cookie | หมุนเวียน Refresh Token และออก Access Token ใหม่ |
| `GET /api/v1/auth/me` | Authenticated | ดึงข้อมูลผู้ใช้ปัจจุบัน บทบาท และตารางสิทธิ์พร้อม Data Scope |
| `GET/POST/PATCH /api/v1/users` | `user.manage` | จัดการบัญชีผู้ใช้งานและรีเซ็ต 2FA |
| `GET/POST/PATCH /api/v1/teams` | `user.manage` | จัดการทีมและผู้จัดการทีม |
| `GET/PUT /api/v1/roles` | `role.manage` | จัดการบทบาทและกำหนดสิทธิ์รายโมดูล (`ALL`, `TEAM`, `OWN`) |

### 2.2 เจ้าของทรัพย์ สินทรัพย์ และค้นหา (`Owners, Assets & Search`)
| Method & Path | สิทธิ์ขั้นต่ำ | คำอธิบาย |
| --- | --- | --- |
| `GET/POST /api/v1/owners` | `owner.read` / `owner.write` | รายการและสร้างเจ้าของทรัพย์ (`OW-xxxxxx`) พร้อมตรวจเบอร์ซ้ำ |
| `GET/POST /api/v1/assets` | `asset.read` / `asset.write` | รายการและสร้างสินทรัพย์ 9 ประเภท (`PR-xxxxxx`, แยก `OWNER` / `AGENT`) |
| `POST /api/v1/buildings/:id/bulk-units` | `asset.write` | สร้างห้องยูนิตอพาร์ตเมนต์จำนวนมากในครั้งเดียว |
| `GET /api/v1/search?q=...` | Authenticated | ค้นหาข้ามเจ้าของทรัพย์ สินทรัพย์ และลูกค้าด้วย `pg_trgm` ภายใต้ Data Scope |

### 2.3 ลูกค้า การจับคู่ นัดดูห้อง การจอง และสัญญา (`CRM & Leasing`)
| Method & Path | สิทธิ์ขั้นต่ำ | คำอธิบาย |
| --- | --- | --- |
| `GET /api/v1/leads/duplicates` | `lead.read` | ตรวจสอบเบอร์โทร/LINE/อีเมลลูกค้าซ้ำโดยไม่เปิดเผยข้อมูลติดต่อ |
| `GET/POST/PATCH /api/v1/leads` | `lead.read` / `lead.write` | จัดการลูกค้า (`LD-xxxxxx`) และเปลี่ยนสถานะใน Pipeline |
| `POST /api/v1/leads/:id/assign` | `lead.assign` | โอนผู้รับผิดชอบลูกค้าพร้อมบันทึกประวัติ `lead_assignments` |
| `GET /api/v1/leads/:id/matches` | `lead.read` | จับคู่ห้องว่างอัตโนมัติเรียงตามคะแนนความตรงเงื่อนไข (`matchScore`) |
| `POST /api/v1/leads/:id/offers` | `lead.write` | บันทึกห้องที่เสนอและสร้างลิงก์แชร์ให้ลูกค้าอายุ 7 วัน |
| `GET/POST /api/v1/appointments` | `appointment.read` / `write` | ปฏิทินทีมและสร้างนัดดูหลายห้องพร้อมตรวจเวลาซ้อน (`tstzrange`) |
| `PATCH /api/v1/appointments/:id/status` | `appointment.write` | อัปเดตสถานะนัดหมายและบังคับบันทึกผลติดตามรายห้องเมื่อ `COMPLETED` |
| `GET/POST /api/v1/bookings` | `booking.read` / `write` | สร้างใบจองห้อง (`BK-xxxxxx`) และล็อกช่วงวันที่เมื่อชำระเงินแล้ว |
| `GET/POST /api/v1/contracts` | `contract.read` / `write` | สร้างสัญญาเช่า (`LS-YYYY-NNNN`) ลงนาม แก้ไข Revision และต่อสัญญา |
| `GET/POST /api/v1/sale-deals` | `sale.read` / `write` | จัดการดีลขาย (`SD-xxxxxx`) ตั้งแต่เสนอราคาจนถึงโอนกรรมสิทธิ์ |

### 2.4 การเงิน ค่านายหน้า รายงาน แจ้งเตือน และ PDPA (`Finance, Reports, Notifications & PDPA`)
| Method & Path | สิทธิ์ขั้นต่ำ | คำอธิบาย |
| --- | --- | --- |
| `GET/POST /api/v1/finance/payments` | `payment.read` / `write` | บันทึกรับ/จ่ายเงินและตัดยอดตารางค่าเช่าห้อง `OWNER` อัตโนมัติ |
| `GET/POST /api/v1/finance/expenses` | `expense.read` / `write` | บันทึกค่าใช้จ่ายห้องและออกรายงานรายได้สุทธิห้อง `OWNER` (Cash Basis) |
| `PUT /api/v1/commissions/:id/splits` | `commission.split.edit` | คำนวณค่านายหน้า 6 สูตรและแบ่งส่วนแบ่งตามบทบาท |
| `POST /api/v1/commissions/:id/approve` | `commission.approve` | อนุมัติค่านายหน้าและเก็บ Snapshot ลง `commission_revisions` |
| `POST /api/v1/commissions/payouts` | `commission.payout` | สร้างรอบจ่ายเงินส่วนแบ่งค่านายหน้าให้ Agent รวมหลายดีล |
| `GET /api/v1/reports/dashboard` | `dashboard.read` | ข้อมูล KPI ผู้บริหาร 5 ตัวหลัก สถานะห้อง และ Funnel |
| `GET /api/v1/reports/summary` | `report.read` | รายงานสรุปตามช่วงเวลา ประเภทห้อง โครงการ Agent และดีล |
| `GET /api/v1/reports/export` | `report.export` | ส่งออกรายงานเป็นไฟล์ CSV (`UTF-8 BOM`) หรือ Excel (`.xlsx`) |
| `GET /api/v1/notifications` | Authenticated | รายการแจ้งเตือนของผู้ใช้, SSE Stream (`/stream`), และตั้งค่าช่องทาง |
| `GET/POST /api/v1/pdpa/...` | `user.manage` | บันทึกความยินยอม, ส่งออกข้อมูล DSR (JSON/PDF), Anonymize, และ Job 24 เดือน |
