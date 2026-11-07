-- AlterTable: Add identity_no (ID Card / Passport No.) to owners and leads
ALTER TABLE "owners" ADD COLUMN IF NOT EXISTS "identity_no" TEXT;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "identity_no" TEXT;
