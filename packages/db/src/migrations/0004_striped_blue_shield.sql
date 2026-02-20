CREATE TYPE "public"."auto_mod_action_type" AS ENUM('block_message', 'send_alert_message', 'timeout');--> statement-breakpoint
CREATE TYPE "public"."auto_mod_event_type" AS ENUM('message_send', 'member_update');--> statement-breakpoint
CREATE TYPE "public"."auto_mod_trigger_type" AS ENUM('keyword', 'spam', 'keyword_preset', 'mention_spam');--> statement-breakpoint
CREATE TYPE "public"."raid_action" AS ENUM('kick', 'ban', 'enable_verification', 'lock_channels', 'alert_only');--> statement-breakpoint
CREATE TYPE "public"."report_reason" AS ENUM('spam', 'harassment', 'hate_speech', 'nsfw', 'self_harm', 'other');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('pending', 'reviewing', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TABLE "auto_mod_action_logs" (
	"id" bigint PRIMARY KEY NOT NULL,
	"guild_id" bigint NOT NULL,
	"rule_id" bigint NOT NULL,
	"user_id" bigint NOT NULL,
	"channel_id" bigint,
	"message_content" text,
	"matched_keyword" varchar(200),
	"action_type" "auto_mod_action_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auto_mod_rules" (
	"id" bigint PRIMARY KEY NOT NULL,
	"guild_id" bigint NOT NULL,
	"name" varchar(100) NOT NULL,
	"creator_id" bigint NOT NULL,
	"event_type" "auto_mod_event_type" NOT NULL,
	"trigger_type" "auto_mod_trigger_type" NOT NULL,
	"trigger_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"actions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"exempt_roles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"exempt_channels" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raid_config" (
	"guild_id" bigint PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"join_threshold" integer DEFAULT 10 NOT NULL,
	"join_window_seconds" integer DEFAULT 60 NOT NULL,
	"action" "raid_action" DEFAULT 'alert_only' NOT NULL,
	"auto_resolve_minutes" integer DEFAULT 30 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" bigint PRIMARY KEY NOT NULL,
	"reporter_id" bigint NOT NULL,
	"reported_user_id" bigint NOT NULL,
	"guild_id" bigint NOT NULL,
	"message_id" bigint,
	"reason" "report_reason" NOT NULL,
	"description" varchar(1000),
	"status" "report_status" DEFAULT 'pending' NOT NULL,
	"reviewer_id" bigint,
	"resolution_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "server_analytics_daily" (
	"guild_id" bigint NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"total_members" integer DEFAULT 0 NOT NULL,
	"new_members" integer DEFAULT 0 NOT NULL,
	"left_members" integer DEFAULT 0 NOT NULL,
	"messages_sent" integer DEFAULT 0 NOT NULL,
	"active_members" integer DEFAULT 0 NOT NULL,
	"voice_minutes" integer DEFAULT 0 NOT NULL,
	"reactions_added" integer DEFAULT 0 NOT NULL,
	"top_channels" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "server_analytics_hourly" (
	"guild_id" bigint NOT NULL,
	"hour" timestamp with time zone NOT NULL,
	"messages" integer DEFAULT 0 NOT NULL,
	"active_users" integer DEFAULT 0 NOT NULL,
	"voice_users" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auto_mod_action_logs" ADD CONSTRAINT "auto_mod_action_logs_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auto_mod_action_logs" ADD CONSTRAINT "auto_mod_action_logs_rule_id_auto_mod_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."auto_mod_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auto_mod_action_logs" ADD CONSTRAINT "auto_mod_action_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auto_mod_rules" ADD CONSTRAINT "auto_mod_rules_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auto_mod_rules" ADD CONSTRAINT "auto_mod_rules_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raid_config" ADD CONSTRAINT "raid_config_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reported_user_id_users_id_fk" FOREIGN KEY ("reported_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_analytics_daily" ADD CONSTRAINT "server_analytics_daily_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_analytics_hourly" ADD CONSTRAINT "server_analytics_hourly_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_analytics_daily" ADD CONSTRAINT "server_analytics_daily_guild_date_unique" UNIQUE ("guild_id", "date");--> statement-breakpoint
ALTER TABLE "server_analytics_hourly" ADD CONSTRAINT "server_analytics_hourly_guild_hour_unique" UNIQUE ("guild_id", "hour");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_auto_mod_action_logs_guild_created" ON "auto_mod_action_logs" ("guild_id", "created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_reports_guild_status" ON "reports" ("guild_id", "status");