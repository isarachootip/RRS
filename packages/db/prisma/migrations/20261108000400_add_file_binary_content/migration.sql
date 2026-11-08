-- AlterTable: Add binary content column to files for persistent DB image/document storage
ALTER TABLE "files" ADD COLUMN IF NOT EXISTS "content" BYTEA;
