# Phase 6: ทดสอบ ส่งมอบ PDPA Deploy (F6-1 ถึง F6-5)

เฟสนี้มี prompt ใหม่ 2 งาน (P23, P24) ให้บันทึกเป็น prompts/P23.md และ prompts/P24.md ตามข้อความด้านล่าง

วาง prompt นี้ใน Claude Code หลังจากวาง 00-CONTINUE.md แล้ว

```text
ทำ Phase 6 ตามลำดับ: P24 → P18 → P19 → P23 ตามขั้นตอนใน prompts/00-CONTINUE.md (งานละหนึ่ง branch หยุดรอหลังแต่ละงาน)
P24 มาก่อน เพราะ E2E ใน P18 ต้องครอบคลุมเรื่อง PDPA ด้วย

P24 — PDPA (F6-5):
- บันทึกความยินยอม: ข้อความที่แสดง, เวอร์ชัน, เวลา, ช่องทาง (หลังบ้าน/เว็บ) ต่อ lead และเจ้าของทรัพย์
- หน้า Admin "คำขอข้อมูลส่วนบุคคล": ขอดู (ส่งออกข้อมูลเป็น JSON/PDF), ขอแก้, ขอลบ = anonymize (ชื่อ เบอร์ อีเมล LINE เป็นค่าไม่ระบุตัวตน) โดยไม่ลบสัญญาและรายการเงินที่กฎหมายบังคับเก็บ
- การ anonymize ต้องมี audit และต้องไม่เก็บค่าเดิมไว้ใน audit_logs (บันทึกเฉพาะว่ามีการลบ)
- job รายเดือน: lead สถานะ LOST/CANCELLED ที่ไม่มีกิจกรรมเกิน [ใส่ เช่น 24] เดือน → anonymize อัตโนมัติ
- บันทึก audit VIEW_SENSITIVE ทุกครั้งที่เปิดเบอร์เต็มหรือเอกสารบัตรประชาชน
- เกณฑ์เสร็จ: เทสต์ยืนยันว่าหลัง anonymize ค้นหาด้วยชื่อ/เบอร์เดิมไม่เจอทั้งในตารางหลักและ audit_logs แต่ยอดในรายงานไม่เปลี่ยน

P18 (F6-1) และ P19 (F6-2, F6-3): ตาม prompts/P18.md และ prompts/P19.md

P23 — Deploy (F6-4):
- Dockerfile แบบ multi-stage สำหรับ api, web, portal (รันด้วย user ที่ไม่ใช่ root) และ docker-compose.prod.yml
- reverse proxy (Caddy) ออก HTTPS อัตโนมัติให้ [ใส่โดเมน เช่น app.example.com, api.example.com, www.example.com]
- ผู้ให้บริการ: [ใส่ เช่น VPS ในไทย, AWS/GCP สิงคโปร์] ฐานข้อมูล: [ใส่ managed PostgreSQL / บนเครื่องเดียวกัน]
- production: COOKIE_SECURE=true, COOKIE_DOMAIN ตามโดเมน, SWAGGER_ENABLED=false, secret ใหม่ทั้งหมด, ไม่มีข้อมูล seed
- CI: merge เข้า main → build image → deploy staging → รัน prisma migrate deploy → smoke test /health; production deploy ด้วย tag v* และต้องกดอนุมัติ
- backup ฐานข้อมูลรายวันนอกเครื่อง, เก็บ 14 วัน, มีสคริปต์กู้คืนที่ทดสอบแล้ว
- ติดตาม error (Sentry หรือเทียบเท่า) และ uptime check /health ทุก 1 นาที
- เกณฑ์เสร็จ: staging เปิดด้วย HTTPS ได้, ล็อกอิน และ cookie ทำงานข้ามโดเมนย่อย, docs/deploy.md อธิบายทุกขั้นรวมถึงการถอยกลับ
- ห้าม deploy production เอง ให้เตรียมทุกอย่างแล้วบอกฉันให้กดอนุมัติ

สาธิตเมื่อจบเฟส:
1) E2E ครบทุกข้อของ SRS ข้อ 9 ผ่าน 3 รอบติดกันบน CI
2) นำเข้าข้อมูลจริงบน staging แล้วยอดตรงกับไฟล์ต้นทาง
3) ลบฐาน staging แล้วกู้คืนจาก backup ได้ภายในเวลาที่บันทึกไว้
4) ผู้ใช้จริงทุกบทบาททำ UAT ตาม docs/uat-checklist.md ผ่านทุกข้อ
5) คำขอลบข้อมูลลูกค้า 1 รายทำเสร็จจากหน้า Admin โดยรายงานเงินไม่เปลี่ยน
```
