-- E2E key history: preserve the previous public key on rotation so the
-- recipient can re-derive the old shared key and decrypt older messages.
ALTER TABLE user_public_keys ADD COLUMN IF NOT EXISTS key_version integer NOT NULL DEFAULT 1;
ALTER TABLE user_public_keys ADD COLUMN IF NOT EXISTS previous_key_jwk text;
