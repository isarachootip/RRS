-- ปิด 2FA ที่ถูกบังคับเปิดตอนเริ่มต้น เพื่อให้บัญชีปัจจุบันเข้าสู่ระบบด้วยรหัสผ่านปกติได้ทันที
UPDATE "users" SET "totp_enabled" = false, "totp_secret" = NULL;
