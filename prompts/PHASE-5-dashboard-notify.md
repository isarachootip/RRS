# Phase 5: Dashboard รายงาน แจ้งเตือน (F5-1 ถึง F5-6)

วาง prompt นี้ใน Claude Code หลังจากวาง 00-CONTINUE.md แล้ว

```text
ทำ Phase 5: P16 และ P17 ตามขั้นตอนใน prompts/00-CONTINUE.md (สองงานนี้ไม่พึ่งกัน ทำคนละ branch)

สิ่งที่มีอยู่แล้ว:
- notification_rules seed แล้ว 12 กฎตาม docs/design.md ข้อ 7 (packages/db/src/seed.ts)
- notifications มี dedupeKey unique กันส่งซ้ำ, users.notificationPrefs และ users.lineUserId
- MailService มีโหมด log/smtp แล้ว
- Redis อยู่ใน docker-compose ใช้กับ BullMQ

P16 (F5-1 ถึง F5-3): ตาม prompts/P16.md
- ตัวเลขทุกตัวมาจาก SQL view ชุดเดียวกันระหว่าง Dashboard และรายงาน เคารพ data scope ของผู้ใช้
- กราฟใช้สีสถานะห้องเดิม (status-available/booked/contracted/unavailable ใน globals.css)
- ผู้ใช้ที่ไม่มีสิทธิ์ report.export กด Export ไม่ได้ และ API ตอบ 403

P17 (F5-4 ถึง F5-6): ตาม prompts/P17.md
- LINE ใช้ LINE Official Account Messaging API (LINE Notify ปิดบริการแล้ว) channel token อยู่ใน .env
- ถ้ายังไม่มี LINE OA ให้ทำช่องทางในระบบและอีเมลก่อน และทำ LINE เป็น adapter ที่ปิดได้
- ทุก job ตั้งเวลาคิดตาม Asia/Bangkok

คำถามที่ต้องตอบก่อนเริ่ม:
- มี LINE Official Account แล้วหรือยัง: [ใส่]
- ผู้ให้บริการอีเมล (D14): [ใส่ เช่น Google Workspace, SendGrid]
- ผู้บริหารดู Dashboard ตัวไหนบ่อยที่สุด 5 ตัว (วางบนสุด): [ใส่]

สาธิตเมื่อจบเฟส:
1) ยอดบน Dashboard เท่ากับผลรวมรายการธุรกรรมในรายงานทุกตัวกรอง และโหลดใน 2 วินาที
2) Manager ทีมสุขุมวิทเห็นเฉพาะตัวเลขทีมตัวเอง
3) Export Excel เปิดใน Excel ได้ ภาษาไทยไม่เพี้ยน และมี audit EXPORT
4) สร้างนัดพรุ่งนี้ → Agent ได้แจ้งเตือน 1 วันและ 2 ชั่วโมงก่อน ครั้งละครั้งเดียว
5) Admin ปิดกฎ "มีลูกค้าใหม่" → ไม่มีแจ้งเตือนนั้นอีก
```
