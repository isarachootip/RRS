# Phase 1: สิทธิ์ ผู้ใช้ ประวัติ ไฟล์ (F1-7 ถึง F1-10)

วาง prompt นี้ใน Claude Code หลังจากวาง 00-CONTINUE.md แล้ว

```text
ทำ Phase 1 ส่วนที่เหลือ: P04 แล้ว P05 ตามขั้นตอนใน prompts/00-CONTINUE.md (งานละหนึ่ง branch หยุดรอหลังแต่ละงาน)

สิ่งที่มีอยู่แล้ว ห้ามสร้างซ้ำ:
- สิทธิ์และ scope เริ่มต้นอยู่ที่ packages/shared/src/permissions.ts และ seed ลง role_permissions แล้ว
- JwtAuthGuard เป็น global guard, req.user = { id, email, roles }
- GET /api/v1/auth/me คืน permissions ที่รวมจากทุกบทบาทแล้ว
- AuditService.log() ใช้แล้วในงานล็อกอิน

P04 (F1-7, F1-8): ทำตาม prompts/P04.md โดย
- PermissionGuard + @Can("lead.read") ทำงานต่อจาก JwtAuthGuard, ใช้ข้อมูลจาก role_permissions ในฐาน (cache ได้ไม่เกิน 60 วินาที)
- DataScopeService.where(user, entity) คืน Prisma where สำหรับ ALL/TEAM/OWN ใช้กับ leads, owners, assets, appointments, bookings, contracts, commissions
- หน้า ตั้งค่า > ผู้ใช้ / ทีม / บทบาทและสิทธิ์ (ตาราง checkbox + เลือก scope) เฉพาะ Admin
- Admin รีเซ็ต 2FA ของผู้ใช้อื่นได้ (บันทึก audit)
- หน้าเว็บซ่อนเมนูที่ไม่มีสิทธิ์โดยใช้ permissions จาก /auth/me แต่การตรวจจริงอยู่ที่ API เสมอ

P05 (F1-9, F1-10): ทำตาม prompts/P05.md โดย
- อัปเกรด AuditService ให้บันทึกอัตโนมัติทุก mutation ผ่าน Prisma client extension ส่ง actor จาก AsyncLocalStorage ของ request
- FileService ใช้ MinIO ใน docker-compose (bucket rrs-files) ผ่าน @aws-sdk/client-s3
- component <Timeline entityType entityId /> ใช้ซ้ำได้ทุกหน้า

สาธิตเมื่อจบเฟส:
1) agent1 เปิดลูกค้าของ agent2 ทาง URL ตรง → ได้หน้า "ไม่มีสิทธิ์" และ API ตอบ 403
2) Admin ปิดสิทธิ์ lead.write ของ AGENT → agent1 แก้ลูกค้าไม่ได้ภายใน 1 นาที
3) แก้ข้อมูลใดก็ได้ → เห็นค่าก่อน/หลังในไทม์ไลน์ และลบประวัติจากฐานไม่ได้
4) อัปโหลด PDF 2MB ได้, ไฟล์ .exe ถูกปฏิเสธ, เปิดไฟล์ผ่านลิงก์ที่หมดอายุใน 5 นาที

คำถามที่ต้องตอบก่อนเริ่ม:
- Manager แก้ข้อมูลทรัพย์สินของทีมอื่นได้หรือไม่: ดูได้ (READ) แต่แก้ไขไม่ได้ (แก้ได้เฉพาะของทีมตัวเอง / Admin เท่านั้นที่แก้ได้ทุกทีม) (D15)
- Agent เห็นรายชื่อลูกค้าของคนอื่นแบบชื่อย่อ (กันสร้างซ้ำ) หรือไม่เห็นเลย: เห็นรายชื่อลูกค้าของคนอื่นแบบชื่อย่อ + เบอร์โทรที่ mask แล้ว (เพื่อกันสร้างซ้ำ) แต่กดดูรายละเอียดหรือแก้ไขไม่ได้ (D16)
```
