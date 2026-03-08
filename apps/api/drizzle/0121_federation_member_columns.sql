ALTER TABLE "guild_members" ADD COLUMN IF NOT EXISTS "remote_user_id" uuid REFERENCES "remote_users"("id") ON DELETE SET NULL;
ALTER TABLE "guild_members" ADD COLUMN IF NOT EXISTS "via_instance_id" uuid REFERENCES "federated_instances"("id") ON DELETE SET NULL;
