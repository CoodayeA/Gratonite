CREATE TABLE IF NOT EXISTS user_quick_reactions (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  emojis text[] NOT NULL DEFAULT ARRAY['👍','❤️','😂','🎉','🔥','😮','😢','👀']
);
