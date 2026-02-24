CREATE TABLE IF NOT EXISTS "nameplates" (
	"id" bigint PRIMARY KEY NOT NULL,
	"name" varchar(64) NOT NULL,
	"description" varchar(255),
	"asset_hash" varchar(64) NOT NULL,
	"animated" boolean DEFAULT false NOT NULL,
	"category" varchar(32),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"available" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "nameplate_id" bigint;
--> statement-breakpoint
INSERT INTO "nameplates" ("id", "name", "description", "asset_hash", "animated", "category", "sort_order", "available")
VALUES
  (910001, 'Aurora Drift', 'Soft shifting gradient with subtle glow.', 'nameplate_aurora.webp', false, 'core', 0, true),
  (910002, 'Sunburst', 'Warm cinematic blend for standout conversations.', 'nameplate_sunburst.webp', false, 'core', 1, true),
  (910003, 'Cyber Grid', 'Angular neon styling for tech-forward profiles.', 'nameplate_cybergrid.webp', false, 'core', 2, true),
  (910004, 'Forest Glass', 'Frosted glass aesthetic with layered depth.', 'nameplate_forestglass.webp', false, 'core', 3, true)
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "avatar_decorations" ("id", "name", "description", "asset_hash", "animated", "category", "sort_order", "available")
VALUES
  (920001, 'Aurora Halo', 'Shimmering halo frame.', 'avatar_decoration_aurora.webp', false, 'core', 0, true),
  (920002, 'Sunburst Frame', 'Warm energetic frame.', 'avatar_decoration_sunburst.webp', false, 'core', 1, true),
  (920003, 'Cyber Ring', 'Crisp neon tech ring.', 'avatar_decoration_cybergrid.webp', false, 'core', 2, true),
  (920004, 'Forest Crest', 'Calm botanical frame.', 'avatar_decoration_forestglass.webp', false, 'core', 3, true)
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "profile_effects" ("id", "name", "description", "asset_hash", "animated", "category", "sort_order", "available")
VALUES
  (930001, 'Aurora Veil', 'Cool-toned layered glow.', 'profile_effect_aurora.webp', false, 'core', 0, true),
  (930002, 'Solar Flare', 'Warm cinematic profile wash.', 'profile_effect_sunburst.webp', false, 'core', 1, true),
  (930003, 'Grid Pulse', 'Futuristic signal overlay.', 'profile_effect_cybergrid.webp', false, 'core', 2, true),
  (930004, 'Forest Mist', 'Soft green atmospheric veil.', 'profile_effect_forestglass.webp', false, 'core', 3, true)
ON CONFLICT ("id") DO NOTHING;
