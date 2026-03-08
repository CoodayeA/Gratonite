CREATE TABLE IF NOT EXISTS "profile_showcase_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "slot" integer NOT NULL,
  "item_type" text NOT NULL,
  "reference_id" text NOT NULL,
  "display_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE ("user_id", "slot")
);
