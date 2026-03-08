CREATE TABLE IF NOT EXISTS "federated_instances" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "base_url" varchar(500) NOT NULL UNIQUE,
  "public_key_pem" text,
  "public_key_id" varchar(500),
  "trust_level" varchar(30) NOT NULL DEFAULT 'auto_discovered',
  "status" varchar(20) NOT NULL DEFAULT 'active',
  "software_version" varchar(50),
  "software_checksum" varchar(100),
  "last_seen_at" timestamp with time zone,
  "failed_heartbeats" integer NOT NULL DEFAULT 0,
  "in_discover" boolean NOT NULL DEFAULT false,
  "trust_score" integer NOT NULL DEFAULT 50,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
