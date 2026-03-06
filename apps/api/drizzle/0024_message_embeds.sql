ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "embeds" jsonb DEFAULT '[]'::jsonb;
