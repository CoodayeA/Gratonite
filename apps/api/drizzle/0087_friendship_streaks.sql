CREATE TABLE friendship_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_interaction TIMESTAMP WITH TIME ZONE,
  friends_since TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);
CREATE INDEX idx_friendship_streaks_user ON friendship_streaks(user_id);
CREATE INDEX idx_friendship_streaks_friend ON friendship_streaks(friend_id);

CREATE TABLE friendship_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  milestone TEXT NOT NULL,
  unlocked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, friend_id, milestone)
);
CREATE INDEX idx_friendship_milestones_user ON friendship_milestones(user_id);
