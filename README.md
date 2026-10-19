# RRS — Property Rental & Sales Management Platform

ระบบบริหารงานเช่า/ขายอสังหาริมทรัพย์ (Owner + Agent) พร้อมเว็บสาธารณะ พัฒนาด้วย AI coding agent (Claude Code) ทีละ prompt

## โครงสร้างโฟลเดอร์

```
apps/api             NestJS API (พอร์ต 4000)
apps/web             หลังบ้าน Next.js (พอร์ต 3000)
apps/portal          เว็บสาธารณะ Next.js (พอร์ต 3001)
packages/db          Prisma schema, migration, seed, เทสต์ constraint
packages/shared      โค้ดที่ใช้ร่วมกัน: attributes ตามประเภททรัพย์, สิทธิ์, เบอร์โทร
CLAUDE.md            บริบทโปรเจกต์และกฎที่ AI อ่านอัตโนมัติทุก session
docs/srs.md          SRS ต้นฉบับ (ถอดจาก PDF)
docs/design.md       วิเคราะห์ ออกแบบ Data model สิทธิ์ ค่านายหน้า แผนพัฒนา
docs/ai-playbook.md  วิธีทำงานกับ AI + ลำดับ prompt ทั้งหมด
docs/decisions.md    คำตอบกฎธุรกิจ (กรอกก่อนเริ่ม prompt ที่เกี่ยวข้อง)
docs/progress.md     สถานะแต่ละ prompt
prompts/P01–P22.md   prompt สั่งงานตามลำดับ phase
prompts/R1–R4.md     prompt แม่แบบ: รีวิวโค้ด แก้บั๊ก เปลี่ยนกฎ ตรวจความครบ
```

## รันโปรเจกต์

```powershell
copy .env.example .env          # ครั้งแรกครั้งเดียว
docker compose up -d            # PostgreSQL 16 (พอร์ต 5433), Redis, MinIO
pnpm install                    # สร้าง Prisma client ให้อัตโนมัติ
pnpm db:migrate                 # สร้างตารางในฐาน rrs
pnpm db:seed                    # ข้อมูลตัวอย่าง: ผู้ใช้ 8, สินทรัพย์ 30, lead 50
pnpm dev                        # API :4000, หลังบ้าน :3000, เว็บสาธารณะ :3001
```

| ที่อยู่ | คืออะไร |
| --- | --- |
| http://localhost:3000 | หลังบ้าน (Admin, Manager, Agent, Accounting) |
| http://localhost:3001 | เว็บสาธารณะ เช่า/ซื้อ/ขาย (ไทย/อังกฤษ) |
| http://localhost:4000/docs | เอกสาร API (Swagger) |
| http://localhost:4000/health | ตรวจสถานะ API และฐานข้อมูล |

**ผู้ใช้ตัวอย่างจาก seed** (รหัสผ่านทุกคน `RrsDev#2026` ใช้ในเครื่องพัฒนาเท่านั้น):
`admin1@rrs.local`, `manager1@rrs.local`, `agent1@rrs.local`, `accounting1@rrs.local` (และ ...2 ของแต่ละบทบาท)
Admin และ Accounting ต้องตั้งการยืนยันสองขั้นตอน (Google/Microsoft Authenticator) ตอนล็อกอินครั้งแรก
ลืมรหัสผ่านตอนพัฒนา: ลิงก์ตั้งรหัสใหม่แสดงใน console ของ API (MAIL_TRANSPORT=log)

ตรวจงานก่อน commit: `pnpm lint`, `pnpm typecheck`, `pnpm test` (เทสต์ฐานข้อมูลใช้ฐาน rrs_test), `pnpm e2e` (Playwright เดสก์ท็อป + มือถือ ต้อง migrate และ seed ฐาน rrs ก่อน)
โครงสร้างฐานข้อมูลดูที่ `docs/erd.md`

## เริ่มต้น

1. ติดตั้ง Git, Node.js 20+, pnpm, Docker Desktop และ Claude Code
2. เปิด terminal ที่โฟลเดอร์นี้ แล้ว `git init` และ commit ไฟล์ทั้งหมด
3. กรอก `docs/decisions.md` ให้มากที่สุดก่อน (อย่างน้อย D02, D03, D09, D10 ก่อน P01)
4. รัน `claude` แล้วสั่ง: `อ่าน prompts/P01.md แล้วทำตาม เริ่มจากเสนอแผนก่อน`
5. รีวิวด้วย `prompts/R1.md` ใน session ใหม่ แล้ว merge และไป prompt ถัดไปตาม `docs/ai-playbook.md` ข้อ 3

คำในวงเล็บเหลี่ยม `[ใส่...]` ใน prompt คือจุดที่ต้องกรอกก่อนส่ง
