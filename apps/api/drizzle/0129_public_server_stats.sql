-- Public server stats toggle
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS public_stats_enabled boolean NOT NULL DEFAULT false;
