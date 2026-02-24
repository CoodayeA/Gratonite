-- Add gratonites reward source
ALTER TYPE "public"."reward_source" ADD VALUE IF NOT EXISTS 'gratonites_reward';
--> statement-breakpoint

-- Create user_streaks table for daily login tracking
CREATE TABLE "user_streaks" (
	"user_id" bigint PRIMARY KEY NOT NULL,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"longest_streak" integer DEFAULT 0 NOT NULL,
	"last_login_at" timestamp with time zone,
	"total_logins" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_streaks" ADD CONSTRAINT "user_streaks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
-- Create gratonites_currency table for user balances
CREATE TABLE "gratonites_balances" (
	"user_id" bigint PRIMARY KEY NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"lifetime_earned" integer DEFAULT 0 NOT NULL,
	"lifetime_spent" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gratonites_balances" ADD CONSTRAINT "gratonites_balances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
-- Create gratonites_transactions table for audit trail
CREATE TABLE "gratonites_transactions" (
	"id" bigint PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"amount" integer NOT NULL,
	"type" varchar(20) NOT NULL, -- 'earn' or 'spend'
	"source" varchar(50) NOT NULL, -- 'daily_login', 'message_milestone', 'streak_bonus', etc.
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gratonites_transactions" ADD CONSTRAINT "gratonites_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "gratonites_transactions_user_id_idx" ON "gratonites_transactions" ("user_id");
--> statement-breakpoint
CREATE INDEX "gratonites_transactions_created_at_idx" ON "gratonites_transactions" ("created_at");
