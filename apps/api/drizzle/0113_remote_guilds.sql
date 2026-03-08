CREATE TABLE IF NOT EXISTS "remote_guilds" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "instance_id" uuid NOT NULL REFERENCES "federated_instances"("id") ON DELETE CASCADE,
  "remote_guild_id" varchar(255) NOT NULL,
  "federation_address" varchar(255) NOT NULL UNIQUE,
  "name" varchar(100) NOT NULL,
  "description" text,
  "icon_url" varchar(500),
  "member_count" integer NOT NULL DEFAULT 0,
  "category" varchar(30),
  "last_synced_at" timestamp with time zone NOT NULL DEFAULT now(),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "remote_guilds_instance_id_remote_guild_id_key" UNIQUE("instance_id", "remote_guild_id")
);
