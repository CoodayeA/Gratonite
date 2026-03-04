ALTER TABLE "guilds" ADD COLUMN IF NOT EXISTS "is_featured" boolean DEFAULT false NOT NULL;
ALTER TABLE "guilds" ADD COLUMN IF NOT EXISTS "is_pinned" boolean DEFAULT false NOT NULL;
ALTER TABLE "guilds" ADD COLUMN IF NOT EXISTS "discover_rank" integer DEFAULT 9999 NOT NULL;

CREATE TABLE IF NOT EXISTS "guild_member_groups" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "guild_id" uuid NOT NULL,
  "name" varchar(64) NOT NULL,
  "color" varchar(16) DEFAULT '#99aab5' NOT NULL,
  "position" integer DEFAULT 0 NOT NULL,
  "created_by" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "guild_member_group_members" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "group_id" uuid NOT NULL,
  "guild_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "guild_member_group_members_group_user_key" UNIQUE("group_id","user_id")
);

DO $$ BEGIN
 ALTER TABLE "guild_member_groups" ADD CONSTRAINT "guild_member_groups_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "guild_member_groups" ADD CONSTRAINT "guild_member_groups_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "guild_member_group_members" ADD CONSTRAINT "guild_member_group_members_group_id_guild_member_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."guild_member_groups"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "guild_member_group_members" ADD CONSTRAINT "guild_member_group_members_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "guild_member_group_members" ADD CONSTRAINT "guild_member_group_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
