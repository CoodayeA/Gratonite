-- Theme reports & ratings junction tables — prevent duplicate abuse
-- Each user can report a theme at most once and rate it at most once.

CREATE TABLE theme_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_id UUID NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(theme_id, user_id)
);

CREATE INDEX theme_reports_theme_id_idx ON theme_reports(theme_id);
CREATE INDEX theme_reports_user_id_idx ON theme_reports(user_id);

CREATE TABLE theme_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_id UUID NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(theme_id, user_id)
);

CREATE INDEX theme_ratings_theme_id_idx ON theme_ratings(theme_id);
CREATE INDEX theme_ratings_user_id_idx ON theme_ratings(user_id);
