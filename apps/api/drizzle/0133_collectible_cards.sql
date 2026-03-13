-- Collectible card system: cards, user collections, packs, and trades

CREATE TABLE IF NOT EXISTS "collectible_cards" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" varchar(100) NOT NULL,
  "image" varchar(500) NOT NULL,
  "rarity" varchar(20) NOT NULL DEFAULT 'common',
  "series" varchar(100) NOT NULL DEFAULT 'default',
  "description" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "card_packs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" varchar(100) NOT NULL,
  "description" text,
  "price" integer NOT NULL DEFAULT 100,
  "cards_count" integer NOT NULL DEFAULT 3,
  "image" varchar(500),
  "series" varchar(100),
  "rarity_weights" jsonb NOT NULL DEFAULT '{"common":0.40,"uncommon":0.30,"rare":0.20,"epic":0.08,"legendary":0.02}',
  "guaranteed_rarity" varchar(20),
  "available" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "user_cards" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "card_id" uuid NOT NULL REFERENCES "collectible_cards"("id") ON DELETE CASCADE,
  "obtained_at" timestamptz NOT NULL DEFAULT now(),
  "obtained_via" varchar(30) NOT NULL DEFAULT 'pack'
);

CREATE INDEX IF NOT EXISTS "user_cards_user_id_idx" ON "user_cards"("user_id");
CREATE INDEX IF NOT EXISTS "user_cards_card_id_idx" ON "user_cards"("card_id");

CREATE TABLE IF NOT EXISTS "card_trades" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "from_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "to_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "resolved_at" timestamptz
);

CREATE TABLE IF NOT EXISTS "card_trade_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "trade_id" uuid NOT NULL REFERENCES "card_trades"("id") ON DELETE CASCADE,
  "user_card_id" uuid NOT NULL REFERENCES "user_cards"("id") ON DELETE CASCADE,
  "direction" varchar(10) NOT NULL
);

CREATE INDEX IF NOT EXISTS "card_trades_from_user_idx" ON "card_trades"("from_user_id");
CREATE INDEX IF NOT EXISTS "card_trades_to_user_idx" ON "card_trades"("to_user_id");
