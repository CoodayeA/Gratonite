CREATE TABLE IF NOT EXISTS "watch_parties" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "channel_id" uuid NOT NULL REFERENCES "channels"("id") ON DELETE CASCADE,
  "host_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "video_url" text NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "current_time" integer NOT NULL DEFAULT 0,
  "is_playing" boolean NOT NULL DEFAULT false,
  "playback_rate" integer NOT NULL DEFAULT 1,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "ended_at" timestamptz
);

CREATE INDEX IF NOT EXISTS "idx_watch_parties_channel_active" ON "watch_parties" ("channel_id", "is_active");

CREATE TABLE IF NOT EXISTS "watch_party_members" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "party_id" uuid NOT NULL REFERENCES "watch_parties"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "joined_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_watch_party_members_party" ON "watch_party_members" ("party_id");
