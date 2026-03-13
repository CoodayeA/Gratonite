-- Server-specific currencies: servers can create their own currency with custom rewards
CREATE TABLE IF NOT EXISTS "guild_currencies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "guild_id" uuid NOT NULL REFERENCES "guilds"("id") ON DELETE CASCADE,
  "name" varchar(50) NOT NULL,
  "emoji" varchar(20) NOT NULL DEFAULT '💰',
  "earn_per_message" integer NOT NULL DEFAULT 1,
  "earn_per_reaction" integer NOT NULL DEFAULT 1,
  "earn_per_voice_minute" integer NOT NULL DEFAULT 2,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE("guild_id")
);

CREATE TABLE IF NOT EXISTS "guild_currency_balances" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "guild_id" uuid NOT NULL REFERENCES "guilds"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "balance" integer NOT NULL DEFAULT 0,
  "lifetime_earned" integer NOT NULL DEFAULT 0,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE("guild_id", "user_id")
);

CREATE INDEX IF NOT EXISTS "guild_currency_balances_guild_user_idx" ON "guild_currency_balances" ("guild_id", "user_id");
CREATE INDEX IF NOT EXISTS "guild_currency_balances_guild_balance_idx" ON "guild_currency_balances" ("guild_id", "balance" DESC);
