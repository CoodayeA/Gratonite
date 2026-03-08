-- Add device and IP tracking to refresh_tokens for session management
ALTER TABLE "refresh_tokens" ADD COLUMN "device" varchar(255) DEFAULT 'Unknown Device';
ALTER TABLE "refresh_tokens" ADD COLUMN "ip" varchar(45) DEFAULT '';
ALTER TABLE "refresh_tokens" ADD COLUMN "last_active_at" timestamp with time zone DEFAULT now();
