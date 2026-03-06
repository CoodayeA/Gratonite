CREATE TABLE referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_id text REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  code text NOT NULL UNIQUE,
  redeemed_at timestamptz,
  reward_granted bool NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
