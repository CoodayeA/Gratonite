CREATE TABLE IF NOT EXISTS "workflows" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "guild_id" uuid NOT NULL REFERENCES "guilds"("id") ON DELETE cascade,
  "name" varchar(100) NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "created_by" uuid REFERENCES "users"("id") ON DELETE set null,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "workflow_triggers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workflow_id" uuid NOT NULL REFERENCES "workflows"("id") ON DELETE cascade,
  "type" varchar(50) NOT NULL,
  "config" jsonb DEFAULT '{}' NOT NULL
);
CREATE TABLE IF NOT EXISTS "workflow_actions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workflow_id" uuid NOT NULL REFERENCES "workflows"("id") ON DELETE cascade,
  "order" integer NOT NULL,
  "type" varchar(50) NOT NULL,
  "config" jsonb DEFAULT '{}' NOT NULL
);
