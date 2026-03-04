-- Add background theme columns to channels table
ALTER TABLE "channels" ADD COLUMN IF NOT EXISTS "background_url" text;
ALTER TABLE "channels" ADD COLUMN IF NOT EXISTS "background_type" varchar(10);
