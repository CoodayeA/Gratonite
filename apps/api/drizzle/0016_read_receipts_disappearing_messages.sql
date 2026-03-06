-- A1: Read receipts — dm_read_state table
CREATE TABLE "dm_read_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"last_read_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_read_message_id" uuid,
	CONSTRAINT "dm_read_state_channel_user_key" UNIQUE("channel_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "dm_read_state" ADD CONSTRAINT "dm_read_state_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dm_read_state" ADD CONSTRAINT "dm_read_state_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- A2: Disappearing messages — expiresAt on messages, disappearTimer on channels
ALTER TABLE "messages" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "disappear_timer" integer;--> statement-breakpoint
-- Partial index so the 60s expiry sweep is fast (only non-null values indexed)
CREATE INDEX "messages_expires_at_idx" ON "messages" ("expires_at") WHERE "expires_at" IS NOT NULL;
