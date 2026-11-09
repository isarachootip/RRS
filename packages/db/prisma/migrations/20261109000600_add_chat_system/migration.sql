-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ChatRoomType" AS ENUM ('CUSTOMER', 'OWNER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ChatSenderType" AS ENUM ('STAFF', 'CUSTOMER', 'OWNER', 'SYSTEM');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "chat_rooms" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" "ChatRoomType" NOT NULL,
    "public_token" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "line_user_id" TEXT,
    "lead_id" UUID,
    "owner_id" UUID,
    "asset_code" TEXT,
    "assigned_agent_id" UUID,
    "unread_count" INTEGER NOT NULL DEFAULT 0,
    "last_message_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_message_preview" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "chat_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "room_id" UUID NOT NULL,
    "sender_type" "ChatSenderType" NOT NULL,
    "sender_user_id" UUID,
    "sender_name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "image_url" TEXT,
    "asset_code" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "chat_rooms_public_token_key" ON "chat_rooms"("public_token");
CREATE INDEX IF NOT EXISTS "chat_rooms_type_last_message_at_idx" ON "chat_rooms"("type", "last_message_at" DESC);
CREATE INDEX IF NOT EXISTS "chat_rooms_line_user_id_idx" ON "chat_rooms"("line_user_id");
CREATE INDEX IF NOT EXISTS "chat_rooms_owner_id_idx" ON "chat_rooms"("owner_id");
CREATE INDEX IF NOT EXISTS "chat_rooms_lead_id_idx" ON "chat_rooms"("lead_id");
CREATE INDEX IF NOT EXISTS "chat_messages_room_id_created_at_idx" ON "chat_messages"("room_id", "created_at");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "chat_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
