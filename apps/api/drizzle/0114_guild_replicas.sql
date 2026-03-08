CREATE TABLE IF NOT EXISTS "guild_replicas" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "guild_id" uuid REFERENCES "guilds"("id") ON DELETE CASCADE,
  "remote_guild_id" uuid REFERENCES "remote_guilds"("id") ON DELETE CASCADE,
  "instance_id" uuid NOT NULL REFERENCES "federated_instances"("id") ON DELETE CASCADE,
  "role" varchar(20) NOT NULL,
  "sync_state" varchar(20) NOT NULL DEFAULT 'syncing',
  "sync_cursor" varchar(255),
  "last_synced_at" timestamp with time zone,
  "enabled" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "guild_replicas_one_target" CHECK (
    (guild_id IS NOT NULL AND remote_guild_id IS NULL) OR
    (guild_id IS NULL AND remote_guild_id IS NOT NULL)
  )
);
