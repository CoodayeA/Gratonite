-- Add message_count to user_profiles for milestone tracking
ALTER TABLE "user_profiles" ADD COLUMN "message_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint

-- Create index for faster queries
CREATE INDEX "user_profiles_message_count_idx" ON "user_profiles" ("message_count");
