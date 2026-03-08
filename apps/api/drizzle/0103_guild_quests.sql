CREATE TABLE guild_quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id UUID NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  quest_type TEXT NOT NULL DEFAULT 'messages',
  target_value INTEGER NOT NULL,
  current_value INTEGER NOT NULL DEFAULT 0,
  reward JSONB NOT NULL DEFAULT '{"coins":100}',
  start_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_date TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  recurring BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE guild_quest_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quest_id UUID NOT NULL REFERENCES guild_quests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contribution_value INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_guild_quests_guild ON guild_quests(guild_id);
CREATE INDEX idx_quest_contributions_quest ON guild_quest_contributions(quest_id);
CREATE INDEX idx_quest_contributions_user ON guild_quest_contributions(user_id);
