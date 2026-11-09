-- CreateTable
CREATE TABLE IF NOT EXISTS "team_chat_channels" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_general" BOOLEAN NOT NULL DEFAULT false,
    "team_id" UUID,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archived_at" TIMESTAMPTZ(6),

    CONSTRAINT "team_chat_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "team_chat_members" (
    "channel_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "last_read_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_chat_members_pkey" PRIMARY KEY ("channel_id","user_id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "team_chat_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "channel_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "sender_name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "mentioned_user_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "team_chat_channels_team_id_key" ON "team_chat_channels"("team_id");
CREATE INDEX IF NOT EXISTS "team_chat_channels_is_general_idx" ON "team_chat_channels"("is_general");
CREATE INDEX IF NOT EXISTS "team_chat_members_user_id_idx" ON "team_chat_members"("user_id");
CREATE INDEX IF NOT EXISTS "team_chat_messages_channel_id_created_at_idx" ON "team_chat_messages"("channel_id", "created_at");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "team_chat_members" ADD CONSTRAINT "team_chat_members_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "team_chat_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "team_chat_messages" ADD CONSTRAINT "team_chat_messages_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "team_chat_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
