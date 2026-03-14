-- Phase 4 & 5: Search, Discovery, Smart Features, Community & Customization
-- Items 81-110

-- 81: Full-text search tsvector column on messages
ALTER TABLE messages ADD COLUMN IF NOT EXISTS search_vector tsvector;
CREATE INDEX IF NOT EXISTS messages_search_vector_idx ON messages USING GIN (search_vector);

-- Trigger to auto-update search_vector on insert/update
CREATE OR REPLACE FUNCTION messages_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', COALESCE(NEW.content, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS messages_search_vector_trigger ON messages;
CREATE TRIGGER messages_search_vector_trigger
  BEFORE INSERT OR UPDATE OF content ON messages
  FOR EACH ROW EXECUTE FUNCTION messages_search_vector_update();

-- Backfill existing messages (run in batches on production)
UPDATE messages SET search_vector = to_tsvector('english', COALESCE(content, ''))
WHERE search_vector IS NULL AND content IS NOT NULL;

-- 85: Notification grouping (add grouped flag to notification preferences)
-- Uses existing user_settings jsonb — no schema change needed

-- 86: DND scheduling
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS dnd_schedule jsonb DEFAULT NULL;
-- Expected shape: { enabled: boolean, startHour: number, startMinute: number, endHour: number, endMinute: number, timezone: string }

-- 88: Channel activity indicators — store last_message_at on channels for fast lookup
ALTER TABLE channels ADD COLUMN IF NOT EXISTS last_message_at timestamptz DEFAULT NULL;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS message_count_24h integer DEFAULT 0;

-- 92: Regex word filter — add regex_patterns column
ALTER TABLE guild_word_filters ADD COLUMN IF NOT EXISTS regex_patterns text[] DEFAULT '{}';
-- Each entry is a regex pattern string

-- 93: Spam detection config
CREATE TABLE IF NOT EXISTS guild_spam_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id uuid NOT NULL REFERENCES guilds(id) ON DELETE CASCADE UNIQUE,
  enabled boolean NOT NULL DEFAULT false,
  max_duplicate_messages integer NOT NULL DEFAULT 5,
  duplicate_window_seconds integer NOT NULL DEFAULT 10,
  max_mentions_per_message integer NOT NULL DEFAULT 10,
  max_links_per_message integer NOT NULL DEFAULT 5,
  rapid_join_threshold integer NOT NULL DEFAULT 10,
  rapid_join_window_seconds integer NOT NULL DEFAULT 30,
  action text NOT NULL DEFAULT 'flag', -- 'flag' | 'mute' | 'kick'
  exempt_roles uuid[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 94: Audit log entries — table already exists (audit_log)
-- Add index for faster guild queries
CREATE INDEX IF NOT EXISTS audit_log_guild_created_idx ON audit_log(guild_id, created_at DESC);

-- 95: Invite analytics — add analytics columns to guild_invites
ALTER TABLE guild_invites ADD COLUMN IF NOT EXISTS last_used_at timestamptz DEFAULT NULL;

-- 97: Custom soundboard
CREATE TABLE IF NOT EXISTS guild_soundboard (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id uuid NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  name varchar(100) NOT NULL,
  file_hash varchar(255) NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji varchar(10) DEFAULT NULL,
  volume real NOT NULL DEFAULT 1.0,
  uses integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS guild_soundboard_guild_idx ON guild_soundboard(guild_id);

-- 99: Community events — already exists (scheduled_events + event_interests)
-- Add recurrence support
ALTER TABLE scheduled_events ADD COLUMN IF NOT EXISTS recurrence jsonb DEFAULT NULL;
-- Shape: { type: 'weekly'|'monthly'|'daily', interval: number }
ALTER TABLE scheduled_events ADD COLUMN IF NOT EXISTS color varchar(7) DEFAULT NULL;

-- 102: Custom profile themes
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS profile_theme jsonb DEFAULT NULL;
-- Shape: { primaryColor, secondaryColor, backgroundImage, cardStyle }

-- 103: Community highlights / weekly digest
CREATE TABLE IF NOT EXISTS guild_highlights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id uuid NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  top_messages jsonb NOT NULL DEFAULT '[]',
  active_members jsonb NOT NULL DEFAULT '[]',
  message_count integer NOT NULL DEFAULT 0,
  member_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(guild_id, week_start)
);

-- 104: Role-based channel layouts
ALTER TABLE guild_members ADD COLUMN IF NOT EXISTS channel_layout jsonb DEFAULT NULL;
-- Shape: { hiddenChannels: string[], pinnedChannels: string[] }

-- 108: Server backup & restore
CREATE TABLE IF NOT EXISTS guild_backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id uuid NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name varchar(200) NOT NULL,
  data jsonb NOT NULL,
  size_bytes integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS guild_backups_guild_idx ON guild_backups(guild_id);

-- 109: Community moderation tools — mod queue
CREATE TABLE IF NOT EXISTS mod_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id uuid NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  type varchar(30) NOT NULL, -- 'message'|'user'|'spam'|'word_filter'
  target_id uuid,
  content text,
  reporter_id uuid REFERENCES users(id) ON DELETE SET NULL,
  status varchar(20) NOT NULL DEFAULT 'pending', -- 'pending'|'approved'|'rejected'
  resolved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mod_queue_guild_status_idx ON mod_queue(guild_id, status);

-- 110: Vanity profile URLs
ALTER TABLE users ADD COLUMN IF NOT EXISTS vanity_url varchar(50) UNIQUE DEFAULT NULL;
