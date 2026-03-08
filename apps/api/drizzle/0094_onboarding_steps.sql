-- 0094_onboarding_steps.sql — Onboarding wizard steps and completions

CREATE TABLE IF NOT EXISTS guild_onboarding_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id UUID NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  step_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  options JSONB NOT NULL DEFAULT '[]',
  display_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS guild_onboarding_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id UUID NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  selections JSONB NOT NULL DEFAULT '{}',
  UNIQUE(guild_id, user_id)
);

CREATE INDEX idx_onboarding_steps_guild ON guild_onboarding_steps(guild_id, display_order);
