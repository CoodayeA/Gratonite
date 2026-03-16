-- Wave 26: Cutting-edge features migration
-- Features: Spatial Rooms, Focus Sessions, Channel Bookmarks, Notification Sounds,
--           Ambient Rooms, Server Status, Reading Lists

-- 1. Spatial Rooms
CREATE TABLE IF NOT EXISTS "spatial_rooms" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "channel_id" uuid NOT NULL UNIQUE REFERENCES "channels"("id") ON DELETE CASCADE,
  "name" varchar(100) DEFAULT 'Spatial Room',
  "width" integer DEFAULT 800,
  "height" integer DEFAULT 600,
  "background_url" text,
  "grid_enabled" boolean DEFAULT true,
  "max_participants" integer DEFAULT 25,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- 2. Focus Sessions
CREATE TABLE IF NOT EXISTS "focus_sessions" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "channel_id" uuid NOT NULL REFERENCES "channels"("id") ON DELETE CASCADE,
  "creator_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name" varchar(100) DEFAULT 'Focus Session',
  "work_duration" integer DEFAULT 1500,
  "break_duration" integer DEFAULT 300,
  "current_phase" varchar(10) DEFAULT 'work',
  "phase_started_at" timestamp,
  "round_number" integer DEFAULT 1,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "ended_at" timestamp
);

CREATE TABLE IF NOT EXISTS "focus_session_participants" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "session_id" uuid NOT NULL REFERENCES "focus_sessions"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "joined_at" timestamp DEFAULT now() NOT NULL,
  "total_focus_time" integer DEFAULT 0,
  "completed_rounds" integer DEFAULT 0,
  UNIQUE("session_id", "user_id")
);

-- 3. Channel Bookmarks
CREATE TABLE IF NOT EXISTS "channel_bookmarks" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "channel_id" uuid NOT NULL REFERENCES "channels"("id") ON DELETE CASCADE,
  "added_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title" varchar(200) NOT NULL,
  "url" text,
  "file_id" uuid,
  "message_id" uuid,
  "type" varchar(20) DEFAULT 'link',
  "position" integer DEFAULT 0,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_channel_bookmarks_channel" ON "channel_bookmarks"("channel_id");

-- 4. Notification Sounds
CREATE TABLE IF NOT EXISTS "notification_sounds" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "name" varchar(100) NOT NULL,
  "file_hash" varchar(255) NOT NULL,
  "duration" real,
  "is_built_in" boolean DEFAULT false,
  "uploaded_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "guild_id" uuid REFERENCES "guilds"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "notification_sound_prefs" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "guild_id" uuid REFERENCES "guilds"("id") ON DELETE CASCADE,
  "event_type" varchar(30) NOT NULL,
  "sound_id" uuid REFERENCES "notification_sounds"("id") ON DELETE SET NULL,
  UNIQUE("user_id", "guild_id", "event_type")
);

-- 5. Ambient Rooms
CREATE TABLE IF NOT EXISTS "ambient_rooms" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "channel_id" uuid NOT NULL UNIQUE REFERENCES "channels"("id") ON DELETE CASCADE,
  "theme" varchar(30) DEFAULT 'coffee_shop',
  "music_enabled" boolean DEFAULT false,
  "music_volume" real DEFAULT 0.3,
  "max_participants" integer DEFAULT 50,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "ambient_room_participants" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "room_id" uuid NOT NULL REFERENCES "ambient_rooms"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "joined_at" timestamp DEFAULT now() NOT NULL,
  "status" varchar(20) DEFAULT 'working',
  UNIQUE("room_id", "user_id")
);

-- 6. Server Status (Bot Heartbeats & Webhook History)
CREATE TABLE IF NOT EXISTS "bot_heartbeats" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "guild_id" uuid NOT NULL REFERENCES "guilds"("id") ON DELETE CASCADE,
  "bot_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "last_ping_at" timestamp DEFAULT now() NOT NULL,
  "status" varchar(20) DEFAULT 'online',
  "metadata" jsonb,
  UNIQUE("guild_id", "bot_id")
);

CREATE TABLE IF NOT EXISTS "webhook_status_history" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "guild_id" uuid NOT NULL REFERENCES "guilds"("id") ON DELETE CASCADE,
  "webhook_id" uuid NOT NULL,
  "status" varchar(20) NOT NULL,
  "status_code" integer,
  "response_time" integer,
  "checked_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_webhook_status_guild" ON "webhook_status_history"("guild_id");
CREATE INDEX IF NOT EXISTS "idx_webhook_status_checked" ON "webhook_status_history"("checked_at");

-- 7. Reading Lists
CREATE TABLE IF NOT EXISTS "reading_list_items" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "channel_id" uuid NOT NULL REFERENCES "channels"("id") ON DELETE CASCADE,
  "guild_id" uuid NOT NULL REFERENCES "guilds"("id") ON DELETE CASCADE,
  "added_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "url" text NOT NULL,
  "title" varchar(300) NOT NULL,
  "description" text,
  "image_url" text,
  "tags" text[] DEFAULT '{}',
  "upvotes" integer DEFAULT 0,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "reading_list_votes" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "item_id" uuid NOT NULL REFERENCES "reading_list_items"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  UNIQUE("item_id", "user_id")
);

CREATE TABLE IF NOT EXISTS "reading_list_read_status" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "item_id" uuid NOT NULL REFERENCES "reading_list_items"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "read_at" timestamp DEFAULT now() NOT NULL,
  UNIQUE("item_id", "user_id")
);

CREATE INDEX IF NOT EXISTS "idx_reading_list_channel" ON "reading_list_items"("channel_id");
CREATE INDEX IF NOT EXISTS "idx_reading_list_guild" ON "reading_list_items"("guild_id");
