CREATE TABLE text_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text_content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(message_id, user_id, text_content)
);
CREATE INDEX idx_text_reactions_message ON text_reactions(message_id);

CREATE TABLE text_reaction_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id UUID NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  use_count INTEGER NOT NULL DEFAULT 1,
  UNIQUE(guild_id, text)
);
CREATE INDEX idx_text_reaction_stats_guild ON text_reaction_stats(guild_id);
