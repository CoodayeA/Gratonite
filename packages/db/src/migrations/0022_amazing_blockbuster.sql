ALTER TABLE "guilds" ADD COLUMN "tags" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "categories" jsonb DEFAULT '[]'::jsonb NOT NULL;
