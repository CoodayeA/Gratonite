CREATE TABLE IF NOT EXISTS "playlists" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "channel_id" uuid NOT NULL REFERENCES "channels"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "created_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "is_active" boolean NOT NULL DEFAULT true,
  "current_track_id" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_playlists_channel" ON "playlists" ("channel_id");

CREATE TABLE IF NOT EXISTS "playlist_tracks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "playlist_id" uuid NOT NULL REFERENCES "playlists"("id") ON DELETE CASCADE,
  "url" text NOT NULL,
  "title" text NOT NULL,
  "artist" text,
  "thumbnail" text,
  "duration" integer NOT NULL DEFAULT 0,
  "added_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "position" integer NOT NULL DEFAULT 0,
  "played" boolean NOT NULL DEFAULT false,
  "skipped" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_playlist_tracks_playlist" ON "playlist_tracks" ("playlist_id", "position");

CREATE TABLE IF NOT EXISTS "playlist_votes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "track_id" uuid NOT NULL REFERENCES "playlist_tracks"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "vote" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_playlist_votes_unique" ON "playlist_votes" ("track_id", "user_id");
