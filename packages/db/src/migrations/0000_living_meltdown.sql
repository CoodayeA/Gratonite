CREATE TYPE "public"."connected_account_provider" AS ENUM('github', 'twitter', 'spotify', 'twitch', 'youtube', 'steam', 'reddit', 'playstation', 'xbox', 'epic_games');--> statement-breakpoint
CREATE TYPE "public"."message_layout" AS ENUM('cozy', 'compact', 'bubbles', 'cards');--> statement-breakpoint
CREATE TYPE "public"."presence_status" AS ENUM('online', 'idle', 'dnd', 'invisible', 'offline');--> statement-breakpoint
CREATE TYPE "public"."privacy_level" AS ENUM('everyone', 'friends', 'server_members', 'nobody');--> statement-breakpoint
CREATE TYPE "public"."relationship_type" AS ENUM('friend', 'blocked', 'pending_incoming', 'pending_outgoing');--> statement-breakpoint
CREATE TYPE "public"."streamer_mode" AS ENUM('off', 'on', 'auto');--> statement-breakpoint
CREATE TYPE "public"."theme_preference" AS ENUM('dark', 'light', 'system', 'oled_dark');--> statement-breakpoint
CREATE TYPE "public"."user_tier" AS ENUM('free', 'crystalline');--> statement-breakpoint
CREATE TYPE "public"."visibility" AS ENUM('everyone', 'friends', 'none');--> statement-breakpoint
CREATE TYPE "public"."corner_style" AS ENUM('rounded', 'sharp', 'pill');--> statement-breakpoint
CREATE TYPE "public"."default_notifications" AS ENUM('all_messages', 'only_mentions');--> statement-breakpoint
CREATE TYPE "public"."explicit_content_filter" AS ENUM('disabled', 'members_without_roles', 'all_members');--> statement-breakpoint
CREATE TYPE "public"."gradient_type" AS ENUM('linear', 'radial', 'mesh', 'none');--> statement-breakpoint
CREATE TYPE "public"."icon_pack" AS ENUM('outlined', 'filled', 'duotone', 'playful', 'custom');--> statement-breakpoint
CREATE TYPE "public"."message_layout_default" AS ENUM('cozy', 'compact', 'bubbles', 'cards');--> statement-breakpoint
CREATE TYPE "public"."nsfw_level" AS ENUM('default', 'explicit', 'safe', 'age_restricted');--> statement-breakpoint
CREATE TYPE "public"."verification_level" AS ENUM('none', 'low', 'medium', 'high', 'very_high');--> statement-breakpoint
CREATE TYPE "public"."channel_type" AS ENUM('GUILD_TEXT', 'GUILD_VOICE', 'GUILD_CATEGORY', 'GUILD_ANNOUNCEMENT', 'GUILD_STAGE_VOICE', 'GUILD_FORUM', 'GUILD_MEDIA', 'GUILD_WIKI', 'GUILD_QA', 'DM', 'GROUP_DM');--> statement-breakpoint
CREATE TYPE "public"."forum_layout" AS ENUM('list', 'gallery');--> statement-breakpoint
CREATE TYPE "public"."forum_sort_order" AS ENUM('latest_activity', 'creation_date');--> statement-breakpoint
CREATE TYPE "public"."thread_type" AS ENUM('public', 'private', 'announcement');--> statement-breakpoint
CREATE TABLE "account_deletion_requests" (
	"user_id" bigint PRIMARY KEY NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"execute_at" timestamp with time zone NOT NULL,
	"message_handling" varchar(20) DEFAULT 'anonymize' NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"executed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "badges" (
	"id" bigint PRIMARY KEY NOT NULL,
	"name" varchar(64) NOT NULL,
	"description" varchar(255) NOT NULL,
	"icon_hash" varchar(64) NOT NULL,
	"icon_animated" boolean DEFAULT false NOT NULL,
	"bit_position" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "badges_bit_position_unique" UNIQUE("bit_position")
);
--> statement-breakpoint
CREATE TABLE "connected_accounts" (
	"id" bigint PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"provider" "connected_account_provider" NOT NULL,
	"provider_account_id" varchar(255) NOT NULL,
	"provider_username" varchar(255) NOT NULL,
	"visibility" "visibility" DEFAULT 'everyone' NOT NULL,
	"show_activity" boolean DEFAULT true NOT NULL,
	"access_token" text,
	"refresh_token" text
);
--> statement-breakpoint
CREATE TABLE "relationships" (
	"user_id" bigint NOT NULL,
	"target_id" bigint NOT NULL,
	"type" "relationship_type" NOT NULL,
	"nickname" varchar(32),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" bigint PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"refresh_token_hash" varchar(128) NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"device_type" varchar(20),
	"approximate_location" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_badges" (
	"user_id" bigint NOT NULL,
	"badge_id" bigint NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_custom_status" (
	"user_id" bigint PRIMARY KEY NOT NULL,
	"text" varchar(128),
	"emoji_id" bigint,
	"emoji_name" varchar(64),
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user_notes" (
	"author_id" bigint NOT NULL,
	"target_id" bigint NOT NULL,
	"content" varchar(256) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"user_id" bigint PRIMARY KEY NOT NULL,
	"display_name" varchar(32) NOT NULL,
	"avatar_hash" varchar(64),
	"avatar_animated" boolean DEFAULT false NOT NULL,
	"banner_hash" varchar(64),
	"banner_animated" boolean DEFAULT false NOT NULL,
	"accent_color" integer,
	"bio" varchar(190),
	"pronouns" varchar(40),
	"avatar_decoration_id" bigint,
	"profile_effect_id" bigint,
	"theme_preference" "theme_preference" DEFAULT 'dark' NOT NULL,
	"tier" "user_tier" DEFAULT 'free' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_id" bigint PRIMARY KEY NOT NULL,
	"locale" varchar(10) DEFAULT 'en-US' NOT NULL,
	"theme" varchar(64) DEFAULT 'obsidian' NOT NULL,
	"message_display" "message_layout" DEFAULT 'cozy' NOT NULL,
	"reduced_motion" boolean DEFAULT false NOT NULL,
	"high_contrast" boolean DEFAULT false NOT NULL,
	"font_scale" integer DEFAULT 100 NOT NULL,
	"saturation" integer DEFAULT 100 NOT NULL,
	"developer_mode" boolean DEFAULT false NOT NULL,
	"streamer_mode" "streamer_mode" DEFAULT 'off' NOT NULL,
	"calm_mode" boolean DEFAULT false NOT NULL,
	"allow_dms_from" "privacy_level" DEFAULT 'everyone' NOT NULL,
	"allow_group_dm_invites_from" "privacy_level" DEFAULT 'everyone' NOT NULL,
	"allow_friend_requests_from" "privacy_level" DEFAULT 'everyone' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" bigint PRIMARY KEY NOT NULL,
	"username" varchar(32) NOT NULL,
	"email" varchar(255) NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"password_hash" text,
	"date_of_birth" text,
	"google_id" varchar(255),
	"mfa_secret" text,
	"mfa_backup_codes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"disabled" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_google_id_unique" UNIQUE("google_id")
);
--> statement-breakpoint
CREATE TABLE "audit_log_entries" (
	"id" bigint PRIMARY KEY NOT NULL,
	"guild_id" bigint NOT NULL,
	"user_id" bigint NOT NULL,
	"target_id" bigint,
	"action_type" integer NOT NULL,
	"changes" jsonb,
	"reason" varchar(512),
	"options" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bans" (
	"guild_id" bigint NOT NULL,
	"user_id" bigint NOT NULL,
	"moderator_id" bigint NOT NULL,
	"reason" varchar(512),
	"delete_message_seconds" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guild_brand" (
	"guild_id" bigint PRIMARY KEY NOT NULL,
	"color_primary" varchar(7),
	"color_secondary" varchar(7),
	"color_accent" varchar(7),
	"gradient_type" "gradient_type" DEFAULT 'none' NOT NULL,
	"gradient_config" jsonb,
	"background_image_hash" varchar(64),
	"background_blur" integer DEFAULT 8 NOT NULL,
	"font_display" varchar(64),
	"font_body" varchar(64),
	"icon_pack" "icon_pack" DEFAULT 'outlined' NOT NULL,
	"noise_opacity" real DEFAULT 0.03 NOT NULL,
	"glass_opacity" real DEFAULT 0.85 NOT NULL,
	"corner_style" "corner_style" DEFAULT 'rounded' NOT NULL,
	"message_layout" "message_layout_default" DEFAULT 'cozy' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guild_members" (
	"user_id" bigint NOT NULL,
	"guild_id" bigint NOT NULL,
	"nickname" varchar(32),
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"premium_since" timestamp with time zone,
	"deaf" boolean DEFAULT false NOT NULL,
	"mute" boolean DEFAULT false NOT NULL,
	"communication_disabled_until" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "guild_roles" (
	"id" bigint PRIMARY KEY NOT NULL,
	"guild_id" bigint NOT NULL,
	"name" varchar(100) NOT NULL,
	"color" integer DEFAULT 0 NOT NULL,
	"hoist" boolean DEFAULT false NOT NULL,
	"icon_hash" varchar(64),
	"icon_animated" boolean DEFAULT false NOT NULL,
	"unicode_emoji" varchar(32),
	"position" integer DEFAULT 0 NOT NULL,
	"permissions" bigint DEFAULT 0 NOT NULL,
	"managed" boolean DEFAULT false NOT NULL,
	"mentionable" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guilds" (
	"id" bigint PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"owner_id" bigint NOT NULL,
	"icon_hash" varchar(64),
	"icon_animated" boolean DEFAULT false NOT NULL,
	"banner_hash" varchar(64),
	"banner_animated" boolean DEFAULT false NOT NULL,
	"splash_hash" varchar(64),
	"discovery_splash_hash" varchar(64),
	"description" varchar(1000),
	"vanity_url_code" varchar(32),
	"preferred_locale" varchar(10) DEFAULT 'en-US' NOT NULL,
	"nsfw_level" "nsfw_level" DEFAULT 'default' NOT NULL,
	"verification_level" "verification_level" DEFAULT 'none' NOT NULL,
	"explicit_content_filter" "explicit_content_filter" DEFAULT 'disabled' NOT NULL,
	"default_message_notifications" "default_notifications" DEFAULT 'only_mentions' NOT NULL,
	"features" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"discoverable" boolean DEFAULT false NOT NULL,
	"member_count" integer DEFAULT 0 NOT NULL,
	"boost_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guilds_vanity_url_code_unique" UNIQUE("vanity_url_code")
);
--> statement-breakpoint
CREATE TABLE "invites" (
	"code" varchar(32) PRIMARY KEY NOT NULL,
	"guild_id" bigint NOT NULL,
	"channel_id" bigint NOT NULL,
	"inviter_id" bigint NOT NULL,
	"max_uses" integer,
	"uses" integer DEFAULT 0 NOT NULL,
	"max_age_seconds" integer,
	"temporary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "member_profiles" (
	"user_id" bigint NOT NULL,
	"guild_id" bigint NOT NULL,
	"nickname" varchar(32),
	"avatar_hash" varchar(64),
	"avatar_animated" boolean DEFAULT false NOT NULL,
	"banner_hash" varchar(64),
	"banner_animated" boolean DEFAULT false NOT NULL,
	"bio" varchar(190)
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" bigint NOT NULL,
	"role_id" bigint NOT NULL,
	"guild_id" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "welcome_screen_channels" (
	"id" bigint PRIMARY KEY NOT NULL,
	"guild_id" bigint NOT NULL,
	"channel_id" bigint NOT NULL,
	"description" varchar(50) NOT NULL,
	"emoji_id" bigint,
	"emoji_name" varchar(64),
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "welcome_screens" (
	"guild_id" bigint PRIMARY KEY NOT NULL,
	"description" varchar(140),
	"enabled" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_permissions" (
	"id" bigint PRIMARY KEY NOT NULL,
	"channel_id" bigint NOT NULL,
	"target_id" bigint NOT NULL,
	"target_type" varchar(10) NOT NULL,
	"allow" bigint DEFAULT 0 NOT NULL,
	"deny" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_read_state" (
	"user_id" bigint NOT NULL,
	"channel_id" bigint NOT NULL,
	"last_read_message_id" bigint,
	"mention_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channels" (
	"id" bigint PRIMARY KEY NOT NULL,
	"guild_id" bigint,
	"type" "channel_type" NOT NULL,
	"name" varchar(100),
	"topic" varchar(1024),
	"position" integer DEFAULT 0 NOT NULL,
	"parent_id" bigint,
	"nsfw" boolean DEFAULT false NOT NULL,
	"last_message_id" bigint,
	"rate_limit_per_user" integer DEFAULT 0 NOT NULL,
	"default_auto_archive_duration" integer,
	"default_thread_rate_limit_per_user" integer,
	"default_sort_order" "forum_sort_order",
	"default_forum_layout" "forum_layout",
	"available_tags" jsonb,
	"default_reaction_emoji" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dm_channels" (
	"id" bigint PRIMARY KEY NOT NULL,
	"type" varchar(10) NOT NULL,
	"owner_id" bigint,
	"name" varchar(100),
	"icon_hash" varchar(64),
	"last_message_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dm_recipients" (
	"channel_id" bigint NOT NULL,
	"user_id" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "thread_members" (
	"thread_id" bigint NOT NULL,
	"user_id" bigint NOT NULL,
	"join_timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "threads" (
	"id" bigint PRIMARY KEY NOT NULL,
	"parent_id" bigint NOT NULL,
	"guild_id" bigint NOT NULL,
	"owner_id" bigint NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" "thread_type" DEFAULT 'public' NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"auto_archive_duration" integer DEFAULT 10080 NOT NULL,
	"locked" boolean DEFAULT false NOT NULL,
	"invitable" boolean DEFAULT true NOT NULL,
	"message_count" integer DEFAULT 0 NOT NULL,
	"member_count" integer DEFAULT 0 NOT NULL,
	"applied_tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_pins" (
	"channel_id" bigint NOT NULL,
	"message_id" bigint NOT NULL,
	"pinned_by" bigint NOT NULL,
	"pinned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_attachments" (
	"id" bigint PRIMARY KEY NOT NULL,
	"message_id" bigint NOT NULL,
	"filename" varchar(255) NOT NULL,
	"description" varchar(1024),
	"content_type" varchar(128) NOT NULL,
	"size" integer NOT NULL,
	"url" text NOT NULL,
	"proxy_url" text NOT NULL,
	"height" integer,
	"width" integer,
	"duration_secs" integer,
	"waveform" text,
	"flags" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_edit_history" (
	"id" bigint PRIMARY KEY NOT NULL,
	"message_id" bigint NOT NULL,
	"content" text NOT NULL,
	"embeds" jsonb,
	"edited_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_reaction_users" (
	"message_id" bigint NOT NULL,
	"emoji_id" bigint,
	"emoji_name" varchar(64) NOT NULL,
	"user_id" bigint NOT NULL,
	"burst" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_reactions" (
	"message_id" bigint NOT NULL,
	"emoji_id" bigint,
	"emoji_name" varchar(64) NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"burst_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" bigint PRIMARY KEY NOT NULL,
	"channel_id" bigint NOT NULL,
	"guild_id" bigint,
	"author_id" bigint NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"type" integer DEFAULT 0 NOT NULL,
	"flags" integer DEFAULT 0 NOT NULL,
	"message_reference" jsonb,
	"referenced_message" jsonb,
	"embeds" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"mentions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"mention_roles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"mention_everyone" boolean DEFAULT false NOT NULL,
	"sticker_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"poll_id" bigint,
	"nonce" varchar(64),
	"pinned" boolean DEFAULT false NOT NULL,
	"tts" boolean DEFAULT false NOT NULL,
	"edited_timestamp" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "poll_answers" (
	"id" bigint PRIMARY KEY NOT NULL,
	"poll_id" bigint NOT NULL,
	"text" varchar(255) NOT NULL,
	"emoji_id" bigint,
	"emoji_name" varchar(64),
	"vote_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "poll_votes" (
	"poll_id" bigint NOT NULL,
	"answer_id" bigint NOT NULL,
	"user_id" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "polls" (
	"id" bigint PRIMARY KEY NOT NULL,
	"question_text" varchar(300) NOT NULL,
	"allow_multiselect" boolean DEFAULT false NOT NULL,
	"expiry" timestamp with time zone,
	"finalized" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduled_messages" (
	"id" bigint PRIMARY KEY NOT NULL,
	"channel_id" bigint NOT NULL,
	"author_id" bigint NOT NULL,
	"content" text NOT NULL,
	"embeds" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account_deletion_requests" ADD CONSTRAINT "account_deletion_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connected_accounts" ADD CONSTRAINT "connected_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_target_id_users_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_badge_id_badges_id_fk" FOREIGN KEY ("badge_id") REFERENCES "public"."badges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_custom_status" ADD CONSTRAINT "user_custom_status_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notes" ADD CONSTRAINT "user_notes_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notes" ADD CONSTRAINT "user_notes_target_id_users_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log_entries" ADD CONSTRAINT "audit_log_entries_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log_entries" ADD CONSTRAINT "audit_log_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bans" ADD CONSTRAINT "bans_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bans" ADD CONSTRAINT "bans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bans" ADD CONSTRAINT "bans_moderator_id_users_id_fk" FOREIGN KEY ("moderator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guild_brand" ADD CONSTRAINT "guild_brand_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guild_members" ADD CONSTRAINT "guild_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guild_members" ADD CONSTRAINT "guild_members_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guild_roles" ADD CONSTRAINT "guild_roles_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guilds" ADD CONSTRAINT "guilds_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_inviter_id_users_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_profiles" ADD CONSTRAINT "member_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_profiles" ADD CONSTRAINT "member_profiles_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_guild_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."guild_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "welcome_screen_channels" ADD CONSTRAINT "welcome_screen_channels_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "welcome_screens" ADD CONSTRAINT "welcome_screens_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_permissions" ADD CONSTRAINT "channel_permissions_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_read_state" ADD CONSTRAINT "channel_read_state_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channels" ADD CONSTRAINT "channels_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dm_channels" ADD CONSTRAINT "dm_channels_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dm_recipients" ADD CONSTRAINT "dm_recipients_channel_id_dm_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."dm_channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dm_recipients" ADD CONSTRAINT "dm_recipients_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thread_members" ADD CONSTRAINT "thread_members_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thread_members" ADD CONSTRAINT "thread_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threads" ADD CONSTRAINT "threads_parent_id_channels_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threads" ADD CONSTRAINT "threads_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threads" ADD CONSTRAINT "threads_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_pins" ADD CONSTRAINT "channel_pins_pinned_by_users_id_fk" FOREIGN KEY ("pinned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_reaction_users" ADD CONSTRAINT "message_reaction_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_answers" ADD CONSTRAINT "poll_answers_poll_id_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_poll_id_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_answer_id_poll_answers_id_fk" FOREIGN KEY ("answer_id") REFERENCES "public"."poll_answers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_messages" ADD CONSTRAINT "scheduled_messages_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_messages_channel_id" ON "messages" USING btree ("channel_id","id");--> statement-breakpoint
CREATE INDEX "idx_messages_author_id" ON "messages" USING btree ("author_id");