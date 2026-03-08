CREATE TABLE IF NOT EXISTS "remote_users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "instance_id" uuid NOT NULL REFERENCES "federated_instances"("id") ON DELETE CASCADE,
  "remote_user_id" varchar(255) NOT NULL,
  "federation_address" varchar(255) NOT NULL UNIQUE,
  "username" varchar(32) NOT NULL,
  "display_name" varchar(64),
  "avatar_url" varchar(500),
  "public_key_pem" text,
  "last_synced_at" timestamp with time zone NOT NULL DEFAULT now(),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "remote_users_instance_id_remote_user_id_key" UNIQUE("instance_id", "remote_user_id")
);
