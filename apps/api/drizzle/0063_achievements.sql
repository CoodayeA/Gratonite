CREATE TABLE IF NOT EXISTS achievements (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  icon text NOT NULL,
  points int NOT NULL DEFAULT 10,
  hidden bool NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS user_achievements (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id text NOT NULL REFERENCES achievements(id),
  earned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, achievement_id)
);

INSERT INTO achievements (id, name, description, icon, points, hidden) VALUES
  ('first_message', 'First Message', 'Send your first message', 'MessageSquare', 5, false),
  ('power_user', 'Power User', 'Send 1,000 messages', 'Zap', 50, false),
  ('social_butterfly', 'Social Butterfly', 'Join 5 servers', 'Users', 25, false),
  ('reaction_king', 'Reaction King', 'Give 100 reactions', 'Smile', 20, false),
  ('voice_veteran', 'Voice Veteran', 'Spend 10 hours in voice', 'Mic', 30, false),
  ('bookmarker', 'Archivist', 'Save 10 bookmarks', 'Bookmark', 15, false),
  ('gifter', 'Generous', 'Gift coins to a friend', 'Gift', 20, false),
  ('streak_7', 'Week Warrior', '7-day login streak', 'Flame', 25, false),
  ('streak_30', 'Monthly Legend', '30-day login streak', 'Crown', 100, false),
  ('early_adopter', 'Early Adopter', 'Completed onboarding', 'Star', 50, false)
ON CONFLICT (id) DO NOTHING;
