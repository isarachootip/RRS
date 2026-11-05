#!/usr/bin/env bash
# ==============================================================================
# RRS Automated PostgreSQL Backup & Restore Script (D20: 14-day retention)
# รองรับการเข้ารหัส AES-256-CBC และอัปโหลดขึ้น S3 แยก Bucket สำรองข้อมูล
# ==============================================================================
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_FILE="${BACKUP_DIR}/rrs-db-${TIMESTAMP}.sql.gz.enc"
PASSPHRASE="${BACKUP_ENCRYPTION_KEY:-rrs-default-backup-key-change-in-prod}"

mkdir -p "${BACKUP_DIR}"

if [[ "${1:-}" == "--restore" ]]; then
  SOURCE_FILE="${2:?กรุณาระบุไฟล์สำรองข้อมูลที่ต้องการกู้คืน}"
  echo "[RRS Restore] กำลังถอดรหัสและกู้คืนข้อมูลจาก ${SOURCE_FILE}..."
  openssl enc -d -aes-256-cbc -pbkdf2 -pass "pass:${PASSPHRASE}" -in "${SOURCE_FILE}" \
    | gunzip \
    | psql "${DATABASE_URL}"
  echo "[RRS Restore] กู้คืนฐานข้อมูลเสร็จสมบูรณ์"
  exit 0
fi

echo "[RRS Backup] กำลังสำรองฐานข้อมูลและเข้ารหัสไปยัง ${BACKUP_FILE}..."
pg_dump "${DATABASE_URL}" --no-owner --no-privileges \
  | gzip -9 \
  | openssl enc -aes-256-cbc -salt -pbkdf2 -pass "pass:${PASSPHRASE}" -out "${BACKUP_FILE}"

if [[ -n "${BACKUP_S3_BUCKET:-}" ]]; then
  aws s3 cp "${BACKUP_FILE}" "s3://${BACKUP_S3_BUCKET}/postgres/$(basename "${BACKUP_FILE}")" \
    --endpoint-url "${S3_ENDPOINT:-https://s3.amazonaws.com}"
fi

# ลบไฟล์สำรองเก่าเกิน 14 วัน (D20)
find "${BACKUP_DIR}" -name "rrs-db-*.sql.gz.enc" -mtime "+${RETENTION_DAYS}" -delete
echo "[RRS Backup] สำรองข้อมูลสำเร็จ (${BACKUP_FILE})"
