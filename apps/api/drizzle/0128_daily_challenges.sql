-- Daily challenges for bonus coins
CREATE TABLE IF NOT EXISTS "daily_challenges" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "date" date NOT NULL,
  "challenge_type" varchar(50) NOT NULL,
  "description" varchar(255) NOT NULL,
  "target" integer NOT NULL,
  "progress" integer NOT NULL DEFAULT 0,
  "completed" boolean NOT NULL DEFAULT false,
  "claimed" boolean NOT NULL DEFAULT false,
  "reward" integer NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "daily_challenges_user_date_idx" ON "daily_challenges" ("user_id", "date");

-- Streak tracking for daily challenge completions
CREATE TABLE IF NOT EXISTS "daily_challenge_streaks" (
  "user_id" uuid PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "current_streak" integer NOT NULL DEFAULT 0,
  "longest_streak" integer NOT NULL DEFAULT 0,
  "last_completed_date" date,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
