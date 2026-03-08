-- Rollback migration 0123: Remove discover columns from remote_guilds
ALTER TABLE "remote_guilds"
  DROP COLUMN IF EXISTS "banner_url",
  DROP COLUMN IF EXISTS "tags",
  DROP COLUMN IF EXISTS "is_approved",
  DROP COLUMN IF EXISTS "average_rating",
  DROP COLUMN IF EXISTS "total_ratings",
  DROP COLUMN IF EXISTS "online_count",
  DROP COLUMN IF EXISTS "updated_at";
