# แผนย้ายข้อมูลจริงและเปิดใช้งานระบบ (Go-Live & Data Migration Plan)

เอกสารนี้กำหนดขั้นตอนการนำเข้าข้อมูลเดิมเข้าสู่ระบบ RRS บนสภาพแวดล้อมจริง การกระทบยอด (Reconciliation) และแผนย้อนกลับ (Rollback Plan)

---

## 1. การเตรียมความพร้อมก่อนวันย้ายข้อมูล (Pre-Migration Checklist)

1. **สำรองข้อมูลฐานข้อมูลปลายทาง** ก่อนเริ่มงานด้วยสคริปต์ `scripts/backup-db.sh`
2. **เตรียมไฟล์ CSV ต้นทาง** (เข้ารหัส `UTF-8`) และไฟล์ตั้งค่าจับคู่คอลัมน์ (`column-mapping.json`)
3. **รันโหมดทดลอง (`--dry-run`)** กับทุกไฟล์เพื่อตรวจสอบแถวที่ข้อมูลไม่สมบูรณ์และแก้ไขต้นทางให้ครบก่อนรันจริง:
   ```bash
   pnpm import:owners --file ./migration/owners.csv --map ./migration/map-owners.json --dry-run
   pnpm import:assets --file ./migration/assets.csv --map ./migration/map-assets.json --dry-run
   pnpm import:leads  --file ./migration/leads.csv  --map ./migration/map-leads.json  --dry-run
   ```

---

## 2. ลำดับการรันนำเข้าข้อมูล (Import Execution Order)

ต้องรันตามลำดับความสัมพันธ์ของ Foreign Key ดังนี้:

1. **ลำดับที่ 1 — โครงการและผู้ใช้งาน (`projects`, `teams`, `users`)**
   - สร้างรายชื่อทีมและบัญชีผู้ใช้งาน Agent / Manager / Accounting ให้ครบเพื่อให้สคริปต์ผูกผู้รับผิดชอบได้ถูกต้อง
2. **ลำดับที่ 2 — เจ้าของทรัพย์ (`owners`)**
   ```bash
   pnpm import:owners --file ./migration/owners.csv --map ./migration/map-owners.json
   ```
   - ระบบแปลงเบอร์โทรเป็นมาตรฐาน `E.164` (`+66...`) อัตโนมัติ และทำงานแบบ Idempotent (รันซ้ำไม่สร้างแถวซ้ำ)
3. **ลำดับที่ 3 — สินทรัพย์และห้อง (`assets`)**
   ```bash
   pnpm import:assets --file ./migration/assets.csv --map ./migration/map-assets.json
   ```
   - ผูกกับ `owners` และจับคู่ชื่อโครงการ (`projects`) แบบ Fuzzy Matching (`pg_trgm`)
4. **ลำดับที่ 4 — ลูกค้า (`leads`)**
   ```bash
   pnpm import:leads --file ./migration/leads.csv --map ./migration/map-leads.json
   ```
5. **ลำดับที่ 5 — สัญญาเช่าที่ยังมีผล (`contracts` สถานะ `ACTIVE`) และตารางค่าเช่า (`rent_schedules`)**
   - นำเข้าสัญญาเช่าที่ยังไม่หมดอายุ พร้อมสร้างงวดค่าเช่ารายเดือนสำหรับห้องประเภท `OWNER` และคำนวณสถานะห้องใหม่ผ่าน `AssetStatusService.recomputeMany`

---

## 3. วิธีตรวจสอบและกระทบยอดก่อน-หลัง (Reconciliation Protocol)

หลังรันนำเข้าข้อมูลครบทุกลำดับ ให้ตรวจสอบความถูกต้อง 4 มิติก่อนเปิดให้ผู้ใช้เข้าใช้งาน:

| รายการตรวจสอบ | วิธีตรวจในระบบ RRS | เกณฑ์ผ่าน |
| --- | --- | --- |
| จำนวนเจ้าของทรัพย์ (`owners`) | เทียบจำนวนแถวใน CSV ที่ผ่านเกณฑ์ กับ `SELECT COUNT(*) FROM owners WHERE archived_at IS NULL` | ตรงกัน 100% |
| จำนวนทรัพย์สินแยกตามประเภทและสถานะ | เทียบหน้า `/` (Dashboard การ์ดสถานะห้อง) กับไฟล์สรุปห้องต้นทาง (`AVAILABLE`, `BOOKED`, `CONTRACTED`) | ตรงกันทุกสถานะ |
| จำนวนลูกค้า (`leads`) แยกตามผู้ดูแล | เทียบจำนวนลูกค้าต่อ Agent ในหน้า `/leads` กับตารางต้นทาง | ตรงกันครบทุกคน |
| ยอดเงินสัญญาเช่าและค่านายหน้าค้างรับ/ค้างจ่าย | เทียบหน้า `/reports` (จัดกลุ่มตาม `CONTRACT_DEAL` และ `OWNERSHIP`) กับรายงานฝ่ายบัญชีเดิม | ยอดตรงกันทุกสตางค์ (ส่วนต่าง `0.00` บาท) |

---

## 4. แผนย้อนกลับกรณีพบปัญหา (Rollback Plan)

หากพบความคลาดเคลื่อนของข้อมูลหรือยอดเงินที่ไม่สามารถแก้ไขได้ภายในหน้าต่างเวลาปิดปรับปรุง (Maintenance Window):

1. **ปิดกั้นทราฟฟิกชั่วคราว** ที่ระดับ Reverse Proxy (`Caddy`) ให้แสดงหน้าปิดปรับปรุง
2. **กู้คืนฐานข้อมูลจาก Snapshot ก่อนเริ่มงาน** ทันที:
   ```bash
   ./scripts/backup-db.sh --restore ./backups/pre-golive-snapshot.enc
   ```
3. **ตรวจสอบสุขภาพระบบ** ที่ `GET /health` และตรวจจำนวนแถวผ่าน `restore-verify`
4. **วิเคราะห์สาเหตุจากไฟล์รายงานข้อผิดพลาด (`import-errors-*.csv`)** แก้ไขข้อมูลต้นทางใน Staging จนผ่านเกณฑ์ Reconciliation 100% ก่อนนัดหมายรอบ Go-Live ใหม่
