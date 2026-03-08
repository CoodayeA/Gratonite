ALTER TABLE "guilds" ADD COLUMN IF NOT EXISTS "federation_address" varchar(255) UNIQUE;
ALTER TABLE "guilds" ADD COLUMN IF NOT EXISTS "federation_enabled" boolean NOT NULL DEFAULT false;
ALTER TABLE "guilds" ADD COLUMN IF NOT EXISTS "home_instance_id" uuid REFERENCES "federated_instances"("id") ON DELETE SET NULL;
ALTER TABLE "guilds" ADD COLUMN IF NOT EXISTS "federation_settings" jsonb DEFAULT '{}';
