CREATE TYPE "public"."oauth_token_type" AS ENUM('access', 'refresh', 'bot');
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "bot" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
CREATE TABLE "oauth2_apps" (
	"id" bigint PRIMARY KEY NOT NULL,
	"owner_id" bigint NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" varchar(200),
	"icon_hash" varchar(64),
	"client_secret_hash" text NOT NULL,
	"redirect_uris" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"bot_public" boolean DEFAULT true NOT NULL,
	"bot_require_code_grant" boolean DEFAULT true NOT NULL,
	"terms_url" varchar(200),
	"privacy_url" varchar(200),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth2_codes" (
	"code" varchar(128) PRIMARY KEY NOT NULL,
	"application_id" bigint NOT NULL,
	"user_id" bigint NOT NULL,
	"redirect_uri" varchar(200) NOT NULL,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth2_tokens" (
	"id" bigint PRIMARY KEY NOT NULL,
	"application_id" bigint NOT NULL,
	"user_id" bigint,
	"token_type" "oauth_token_type" NOT NULL,
	"token_hash" text NOT NULL,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bots" (
	"application_id" bigint PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"token_hash" text NOT NULL,
	"public" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "slash_commands" (
	"id" bigint PRIMARY KEY NOT NULL,
	"application_id" bigint NOT NULL,
	"guild_id" bigint,
	"name" varchar(32) NOT NULL,
	"description" varchar(100) NOT NULL,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"default_member_permissions" varchar(32) DEFAULT '0',
	"dm_permission" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "oauth2_apps" ADD CONSTRAINT "oauth2_apps_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth2_codes" ADD CONSTRAINT "oauth2_codes_application_id_oauth2_apps_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."oauth2_apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth2_codes" ADD CONSTRAINT "oauth2_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth2_tokens" ADD CONSTRAINT "oauth2_tokens_application_id_oauth2_apps_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."oauth2_apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth2_tokens" ADD CONSTRAINT "oauth2_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bots" ADD CONSTRAINT "bots_application_id_oauth2_apps_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."oauth2_apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bots" ADD CONSTRAINT "bots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slash_commands" ADD CONSTRAINT "slash_commands_application_id_oauth2_apps_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."oauth2_apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slash_commands" ADD CONSTRAINT "slash_commands_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;
