-- RSS feed subscriptions for guild channels
CREATE TABLE IF NOT EXISTS "rss_feeds" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "guild_id" uuid NOT NULL REFERENCES "guilds"("id") ON DELETE CASCADE,
  "channel_id" uuid NOT NULL REFERENCES "channels"("id") ON DELETE CASCADE,
  "feed_url" text NOT NULL,
  "title" varchar(200),
  "poll_interval_minutes" integer NOT NULL DEFAULT 30,
  "last_fetched_at" timestamp with time zone,
  "last_item_guid" text,
  "content_filter" text,
  "enabled" boolean NOT NULL DEFAULT true,
  "created_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "rss_feeds_channel_id_idx" ON "rss_feeds" ("channel_id");
CREATE INDEX IF NOT EXISTS "rss_feeds_guild_id_idx" ON "rss_feeds" ("guild_id");
