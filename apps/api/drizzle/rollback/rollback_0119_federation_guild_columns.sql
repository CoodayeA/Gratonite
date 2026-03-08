-- Rollback: Remove federation columns from guilds table
ALTER TABLE "guilds" DROP COLUMN IF EXISTS "federation_settings";
ALTER TABLE "guilds" DROP COLUMN IF EXISTS "home_instance_id";
ALTER TABLE "guilds" DROP COLUMN IF EXISTS "federation_enabled";
ALTER TABLE "guilds" DROP COLUMN IF EXISTS "federation_address";
