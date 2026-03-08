-- Rollback: Remove federation columns from guild_members table
ALTER TABLE "guild_members" DROP COLUMN IF EXISTS "via_instance_id";
ALTER TABLE "guild_members" DROP COLUMN IF EXISTS "remote_user_id";
