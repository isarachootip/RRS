# คู่มือการติดตั้งและปล่อยเวอร์ชัน (Deployment & Operations Runbook)

ระบบ RRS ใช้สถาปัตยกรรม **VPS + Docker Compose + Caddy Auto-HTTPS** (`D20`) รองรับการแยกสภาพแวดล้อม `Staging` และ `Production` พร้อม CI/CD อัตโนมัติผ่าน GitHub Actions (`.github/workflows/deploy.yml`)

---

## 1. การตั้งค่าเซิร์ฟเวอร์ครั้งแรก (First-Time Server Setup)

1. **เตรียมเซิร์ฟเวอร์ Ubuntu 24.04 LTS** (อย่างน้อย 4 vCPU, RAM 8 GB, SSD 80 GB) และติดตั้ง Docker Engine + Docker Compose Plugin
2. **ชี้ DNS (`A Record`)** ทั้ง 3 โดเมนมายัง IP ของ VPS:
   - `API_DOMAIN` (เช่น `api.rrs.example.com`)
   - `BACKOFFICE_DOMAIN` (เช่น `app.rrs.example.com`)
   - `PORTAL_DOMAIN` (เช่น `www.rrs.example.com`)
3. **โคลนโปรเจกต์และตั้งค่าไฟล์ `.env`** ที่ `/opt/rrs`:
   ```bash
   sudo mkdir -p /opt/rrs && sudo chown $USER:$USER /opt/rrs
   git clone https://github.com/isarachootip/RRS.git /opt/rrs
   cd /opt/rrs
   cp .env.example .env
   ```
   กำหนดค่าสำคัญใน `.env`:
   - `POSTGRES_PASSWORD`, `DATABASE_URL`, `REDIS_URL`
   - `JWT_ACCESS_SECRET`, `REFRESH_TOKEN_PEPPER`, `TOTP_ENCRYPTION_KEY` (สุ่มความยาวอย่างน้อย 32 ตัวอักษร)
   - `API_DOMAIN`, `BACKOFFICE_DOMAIN`, `PORTAL_DOMAIN`, `ACME_EMAIL`
   - `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`
   - `BACKUP_ENCRYPTION_KEY`, `BACKUP_RETENTION_DAYS=14`
4. **สั่งรันระบบและทำ Migration ครั้งแรก**:
   ```bash
   docker compose -f docker-compose.prod.yml up -d postgres redis
   docker compose -f docker-compose.prod.yml build
   docker compose -f docker-compose.prod.yml run --rm api npx prisma migrate deploy --schema=packages/db/prisma/schema.prisma
   docker compose -f docker-compose.prod.yml up -d
   ```
   Caddy จะขอใบรับรอง TLS (Let's Encrypt) ให้ทั้ง 3 โดเมนโดยอัตโนมัติ

---

## 2. ขั้นตอนการปล่อยเวอร์ชันใหม่ (Release Workflow)

1. **Staging (อัตโนมัติเมื่อ Merge เข้า `main`)**:
   - เมื่อรวม Pull Request เข้าสู่กิ่ง `main` เวิร์กโฟลว์ `.github/workflows/deploy.yml` (`deploy-staging`) จะเชื่อมต่อไปยังเซิร์ฟเวอร์ Staging รัน `prisma migrate deploy` รีสตาร์ทคอนเทนเนอร์ และยิง Smoke Test ที่ `https://$STAGING_API_DOMAIN/health`
2. **Production (เมื่อติด Git Tag `v*` และอนุมัติใน GitHub Environment)**:
   - สร้างและส่งแท็กเวอร์ชัน เช่น:
     ```bash
     git tag v1.0.0
     git push origin v1.0.0
     ```
   - ผู้อนุมัติกด **Approve & Deploy** ในหน้า GitHub Actions (`production` Environment)
   - ระบบจะสำรองฐานข้อมูลด้วย `./scripts/backup-db.sh` อัตโนมัติก่อนรัน `prisma migrate deploy` และอัปเดตคอนเทนเนอร์

---

## 3. ขั้นตอนการย้อนกลับเมื่อเกิดเหตุฉุกเฉิน (Rollback Procedure)

1. **กรณีโค้ดมีปัญหาแต่ไม่มีการเปลี่ยนโครงสร้างตารางที่กระทบเวอร์ชันก่อนหน้า**:
   ```bash
   cd /opt/rrs
   git checkout v1.0.0 # แท็กเสถียรก่อนหน้า
   docker compose -f docker-compose.prod.yml up -d --build
   ```
2. **กรณีต้องกู้คืนฐานข้อมูลกลับไปยังจุดก่อนปล่อยเวอร์ชัน**:
   ```bash
   cd /opt/rrs
   ./scripts/backup-db.sh --restore ./backups/rrs-db-<TIMESTAMP>.sql.gz.enc
   ```
3. **ตรวจสอบสถานะหลังย้อนกลับ**:
   ```bash
   curl -fsS https://$API_DOMAIN/health
   docker compose -f docker-compose.prod.yml ps
   ```
