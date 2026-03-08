CREATE TABLE IF NOT EXISTS "federation_key_pairs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "key_id" varchar(500) NOT NULL UNIQUE,
  "public_key_pem" text NOT NULL,
  "private_key_pem" text NOT NULL,
  "algorithm" varchar(30) NOT NULL DEFAULT 'ed25519',
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
