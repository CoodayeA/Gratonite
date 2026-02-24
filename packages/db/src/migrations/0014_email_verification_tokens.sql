CREATE TABLE IF NOT EXISTS "email_verification_tokens" (
  "id" bigint PRIMARY KEY NOT NULL,
  "user_id" bigint NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token_hash" varchar(128) NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "used_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "email_verification_tokens_token_hash_idx"
  ON "email_verification_tokens" ("token_hash");

CREATE INDEX IF NOT EXISTS "email_verification_tokens_user_id_idx"
  ON "email_verification_tokens" ("user_id");

CREATE INDEX IF NOT EXISTS "email_verification_tokens_expires_at_idx"
  ON "email_verification_tokens" ("expires_at");
