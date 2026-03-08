-- Phase 9: Extend remote_guilds for Discover registry
ALTER TABLE "remote_guilds"
  ADD COLUMN IF NOT EXISTS "banner_url" varchar(500),
  ADD COLUMN IF NOT EXISTS "tags" jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "is_approved" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "average_rating" real NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "total_ratings" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "online_count" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone NOT NULL DEFAULT now();
