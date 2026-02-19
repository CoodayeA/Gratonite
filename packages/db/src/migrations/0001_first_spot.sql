CREATE TYPE "public"."stage_privacy_level" AS ENUM('public', 'guild_only');--> statement-breakpoint
CREATE TABLE "soundboard_sounds" (
	"id" bigint PRIMARY KEY NOT NULL,
	"guild_id" bigint NOT NULL,
	"name" varchar(32) NOT NULL,
	"sound_hash" varchar(64) NOT NULL,
	"volume" real DEFAULT 1 NOT NULL,
	"emoji_id" bigint,
	"emoji_name" varchar(64),
	"uploader_id" bigint NOT NULL,
	"available" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stage_instances" (
	"id" bigint PRIMARY KEY NOT NULL,
	"guild_id" bigint NOT NULL,
	"channel_id" bigint NOT NULL,
	"topic" varchar(120) NOT NULL,
	"privacy_level" "stage_privacy_level" DEFAULT 'guild_only' NOT NULL,
	"scheduled_event_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voice_states" (
	"user_id" bigint PRIMARY KEY NOT NULL,
	"channel_id" bigint NOT NULL,
	"guild_id" bigint,
	"session_id" varchar(255) NOT NULL,
	"deaf" boolean DEFAULT false NOT NULL,
	"mute" boolean DEFAULT false NOT NULL,
	"self_deaf" boolean DEFAULT false NOT NULL,
	"self_mute" boolean DEFAULT false NOT NULL,
	"self_stream" boolean DEFAULT false NOT NULL,
	"self_video" boolean DEFAULT false NOT NULL,
	"suppress" boolean DEFAULT false NOT NULL,
	"request_to_speak_timestamp" timestamp with time zone,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "soundboard_sounds" ADD CONSTRAINT "soundboard_sounds_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soundboard_sounds" ADD CONSTRAINT "soundboard_sounds_uploader_id_users_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_instances" ADD CONSTRAINT "stage_instances_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_instances" ADD CONSTRAINT "stage_instances_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_states" ADD CONSTRAINT "voice_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_states" ADD CONSTRAINT "voice_states_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_states" ADD CONSTRAINT "voice_states_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_voice_states_channel_id" ON "voice_states" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "idx_voice_states_guild_id" ON "voice_states" USING btree ("guild_id");