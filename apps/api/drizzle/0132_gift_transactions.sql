-- Gift subscriptions (boosts, premium, coins)
CREATE TABLE IF NOT EXISTS "gift_transactions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "sender_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "recipient_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "gift_type" text NOT NULL,
  "guild_id" uuid,
  "quantity" integer NOT NULL DEFAULT 1,
  "message" text,
  "redeem_code" text NOT NULL UNIQUE,
  "status" text NOT NULL DEFAULT 'pending',
  "coins_cost" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "redeemed_at" timestamptz,
  "expires_at" timestamptz
);

CREATE INDEX IF NOT EXISTS "gift_transactions_sender_idx" ON "gift_transactions"("sender_id");
CREATE INDEX IF NOT EXISTS "gift_transactions_recipient_idx" ON "gift_transactions"("recipient_id");
CREATE INDEX IF NOT EXISTS "gift_transactions_redeem_code_idx" ON "gift_transactions"("redeem_code");
