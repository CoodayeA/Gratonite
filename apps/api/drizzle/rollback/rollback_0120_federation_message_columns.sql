-- Rollback: Remove federation columns from messages table
ALTER TABLE "messages" DROP COLUMN IF EXISTS "federation_signature";
ALTER TABLE "messages" DROP COLUMN IF EXISTS "remote_author_id";
ALTER TABLE "messages" DROP COLUMN IF EXISTS "remote_message_id";
ALTER TABLE "messages" DROP COLUMN IF EXISTS "origin_instance_id";
