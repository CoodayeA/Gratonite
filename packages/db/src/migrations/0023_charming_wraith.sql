CREATE TYPE "public"."cosmetic_type" AS ENUM('avatar_decoration', 'effect', 'nameplate', 'soundboard');--> statement-breakpoint
CREATE TABLE "cosmetic_purchases" (
	"id" bigint PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"cosmetic_id" bigint NOT NULL,
	"purchased_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_equipped" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cosmetics" (
	"id" bigint PRIMARY KEY NOT NULL,
	"creator_id" bigint NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"type" "cosmetic_type" NOT NULL,
	"preview_image_url" text,
	"asset_url" text,
	"price" integer DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "poll_answers" ALTER COLUMN "text" SET DATA TYPE varchar(55);--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "widgets" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "apple_id" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "facebook_id" varchar(255);--> statement-breakpoint
ALTER TABLE "poll_answers" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "poll_votes" ADD COLUMN "id" bigint PRIMARY KEY NOT NULL;--> statement-breakpoint
ALTER TABLE "poll_votes" ADD COLUMN "voted_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "polls" ADD COLUMN "channel_id" bigint NOT NULL;--> statement-breakpoint
ALTER TABLE "polls" ADD COLUMN "guild_id" bigint;--> statement-breakpoint
ALTER TABLE "polls" ADD COLUMN "author_id" bigint NOT NULL;--> statement-breakpoint
ALTER TABLE "polls" ADD COLUMN "duration" integer;--> statement-breakpoint
ALTER TABLE "polls" ADD COLUMN "total_voters" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "polls" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "scheduled_messages" ADD COLUMN "guild_id" bigint NOT NULL;--> statement-breakpoint
ALTER TABLE "scheduled_messages" ADD COLUMN "sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "cosmetic_purchases" ADD CONSTRAINT "cosmetic_purchases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cosmetic_purchases" ADD CONSTRAINT "cosmetic_purchases_cosmetic_id_cosmetics_id_fk" FOREIGN KEY ("cosmetic_id") REFERENCES "public"."cosmetics"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cosmetics" ADD CONSTRAINT "cosmetics_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cosmetic_purchases_user_id_idx" ON "cosmetic_purchases" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "cosmetic_purchases_cosmetic_id_idx" ON "cosmetic_purchases" USING btree ("cosmetic_id");--> statement-breakpoint
CREATE INDEX "cosmetics_creator_id_idx" ON "cosmetics" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "cosmetics_type_idx" ON "cosmetics" USING btree ("type");--> statement-breakpoint
CREATE INDEX "cosmetics_is_published_idx" ON "cosmetics" USING btree ("is_published");--> statement-breakpoint
ALTER TABLE "polls" ADD CONSTRAINT "polls_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_poll_answers_poll_id" ON "poll_answers" USING btree ("poll_id");--> statement-breakpoint
CREATE INDEX "idx_poll_votes_poll_id" ON "poll_votes" USING btree ("poll_id");--> statement-breakpoint
CREATE INDEX "idx_poll_votes_user_poll" ON "poll_votes" USING btree ("user_id","poll_id");--> statement-breakpoint
CREATE INDEX "idx_polls_channel_id" ON "polls" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "idx_polls_guild_id" ON "polls" USING btree ("guild_id");--> statement-breakpoint
CREATE INDEX "idx_scheduled_messages_guild_id" ON "scheduled_messages" USING btree ("guild_id");--> statement-breakpoint
CREATE INDEX "idx_scheduled_messages_channel_id" ON "scheduled_messages" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "idx_scheduled_messages_scheduled_for" ON "scheduled_messages" USING btree ("scheduled_for","status");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_apple_id_unique" UNIQUE("apple_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_facebook_id_unique" UNIQUE("facebook_id");--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "uq_poll_votes_user_answer" UNIQUE("user_id","answer_id");