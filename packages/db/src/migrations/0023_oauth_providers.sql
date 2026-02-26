-- Add Apple and Facebook OAuth columns to users table
ALTER TABLE "users" ADD COLUMN "apple_id" varchar(255) UNIQUE;
ALTER TABLE "users" ADD COLUMN "facebook_id" varchar(255) UNIQUE;
