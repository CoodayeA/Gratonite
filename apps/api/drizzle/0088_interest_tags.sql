CREATE TABLE interest_tags (
  tag TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  icon TEXT
);

CREATE TABLE user_interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tag TEXT NOT NULL REFERENCES interest_tags(tag) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, tag)
);
CREATE INDEX idx_user_interests_user ON user_interests(user_id);
CREATE INDEX idx_user_interests_tag ON user_interests(tag);

-- Default tags
INSERT INTO interest_tags (tag, category) VALUES
  ('fps', 'Gaming'),
  ('mmorpg', 'Gaming'),
  ('strategy', 'Gaming'),
  ('pixel-art', 'Creative'),
  ('3d-modeling', 'Creative'),
  ('writing', 'Creative'),
  ('guitar', 'Music'),
  ('electronic', 'Music'),
  ('hip-hop', 'Music'),
  ('coding', 'Tech'),
  ('web-dev', 'Tech'),
  ('gamedev', 'Tech'),
  ('fitness', 'Lifestyle'),
  ('cooking', 'Lifestyle'),
  ('travel', 'Lifestyle'),
  ('anime', 'Entertainment'),
  ('movies', 'Entertainment'),
  ('reading', 'Entertainment');
