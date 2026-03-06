-- Migration: E2E Encryption for DMs (Batch 5)
-- Adds user_public_keys table and encrypted-message columns to messages.

CREATE TABLE IF NOT EXISTS "user_public_keys" (
  "user_id" uuid PRIMARY KEY REFERENCES "users"("id") ON DELETE cascade,
  "public_key_jwk" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "is_encrypted" boolean DEFAULT false NOT NULL;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "encrypted_content" text;
