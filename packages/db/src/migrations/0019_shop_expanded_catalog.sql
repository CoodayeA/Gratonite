-- Expand shop catalog to ~20 items per category
-- Adds 14 more avatar decorations, 14 profile effects, 14 nameplates

-- ============================================================================
-- Avatar Decorations (continued from IDs 1000000000000001-1000000000000006)
-- ============================================================================

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000019, 'Cherry Bloom', 'Soft pink petals circle your avatar in springtime vibes.', 'avatar_decoration', 'avatar_decorations', 120, NULL, '{}'::jsonb, true, false, 7, NOW(), NOW());
--> statement-breakpoint

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000020, 'Thunder Ring', 'Electric bolts arc around your avatar in a storm of energy.', 'avatar_decoration', 'avatar_decorations', 180, NULL, '{}'::jsonb, true, false, 8, NOW(), NOW());
--> statement-breakpoint

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000021, 'Emerald Wreath', 'A lush vine border with green gemstone accents.', 'avatar_decoration', 'avatar_decorations', 150, NULL, '{}'::jsonb, true, false, 9, NOW(), NOW());
--> statement-breakpoint

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000022, 'Void Edge', 'A dark matter border that warps light around your avatar.', 'avatar_decoration', 'avatar_decorations', 200, NULL, '{}'::jsonb, true, true, 10, NOW(), NOW());
--> statement-breakpoint

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000023, 'Sakura Petals', 'Floating cherry blossom petals drift around your avatar.', 'avatar_decoration', 'avatar_decorations', 130, NULL, '{}'::jsonb, true, false, 11, NOW(), NOW());
--> statement-breakpoint

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000024, 'Magma Ring', 'Molten lava flows around your avatar in an endless loop.', 'avatar_decoration', 'avatar_decorations', 220, NULL, '{}'::jsonb, true, false, 12, NOW(), NOW());
--> statement-breakpoint

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000025, 'Moonlight Halo', 'A gentle silver glow like moonlight reflecting on water.', 'avatar_decoration', 'avatar_decorations', 160, NULL, '{}'::jsonb, true, false, 13, NOW(), NOW());
--> statement-breakpoint

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000026, 'Spectrum Shift', 'A rainbow-cycling border that smoothly transitions colors.', 'avatar_decoration', 'avatar_decorations', 250, NULL, '{}'::jsonb, true, true, 14, NOW(), NOW());
--> statement-breakpoint

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000027, 'Runic Circle', 'Ancient glowing runes orbit your avatar.', 'avatar_decoration', 'avatar_decorations', 175, NULL, '{}'::jsonb, true, false, 15, NOW(), NOW());
--> statement-breakpoint

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000028, 'Ocean Tide', 'Waves and sea foam swirl around your avatar.', 'avatar_decoration', 'avatar_decorations', 140, NULL, '{}'::jsonb, true, false, 16, NOW(), NOW());
--> statement-breakpoint

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000029, 'Diamond Edge', 'A shimmering diamond-encrusted border frame.', 'avatar_decoration', 'avatar_decorations', 300, NULL, '{}'::jsonb, true, true, 17, NOW(), NOW());
--> statement-breakpoint

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000030, 'Glitch Frame', 'A digital corruption effect that distorts at the edges.', 'avatar_decoration', 'avatar_decorations', 110, NULL, '{}'::jsonb, true, false, 18, NOW(), NOW());
--> statement-breakpoint

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000031, 'Autumn Leaves', 'Golden and crimson leaves swirl around your avatar.', 'avatar_decoration', 'avatar_decorations', 120, NULL, '{}'::jsonb, true, false, 19, NOW(), NOW());
--> statement-breakpoint

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000032, 'Nebula Swirl', 'A cosmic nebula gas cloud wrapping your avatar.', 'avatar_decoration', 'avatar_decorations', 190, NULL, '{}'::jsonb, true, false, 20, NOW(), NOW());
--> statement-breakpoint

-- ============================================================================
-- Profile Effects (continued from IDs 1000000000000007-1000000000000012)
-- ============================================================================

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000033, 'Lightning Storm', 'Electric arcs flash across your profile intermittently.', 'profile_effect', 'profile_effects', 280, NULL, '{}'::jsonb, true, true, 7, NOW(), NOW());
--> statement-breakpoint

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000034, 'Snowfall', 'Gentle snowflakes drift down your profile.', 'profile_effect', 'profile_effects', 150, NULL, '{}'::jsonb, true, false, 8, NOW(), NOW());
--> statement-breakpoint

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000035, 'Confetti Burst', 'A celebration of colorful confetti rains down.', 'profile_effect', 'profile_effects', 180, NULL, '{}'::jsonb, true, false, 9, NOW(), NOW());
--> statement-breakpoint

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000036, 'Golden Sparkle', 'Luxurious golden particles shimmer across your profile.', 'profile_effect', 'profile_effects', 250, NULL, '{}'::jsonb, true, true, 10, NOW(), NOW());
--> statement-breakpoint

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000037, 'Underwater', 'Bubbles and aquatic light refraction fill your profile.', 'profile_effect', 'profile_effects', 200, NULL, '{}'::jsonb, true, false, 11, NOW(), NOW());
--> statement-breakpoint

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000038, 'Matrix Rain', 'Cascading green digital code rains down your profile.', 'profile_effect', 'profile_effects', 160, NULL, '{}'::jsonb, true, false, 12, NOW(), NOW());
--> statement-breakpoint

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000039, 'Fireflies', 'Warm glowing fireflies drift lazily across your profile.', 'profile_effect', 'profile_effects', 170, NULL, '{}'::jsonb, true, false, 13, NOW(), NOW());
--> statement-breakpoint

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000040, 'Plasma Wave', 'Flowing plasma energy ripples across your profile.', 'profile_effect', 'profile_effects', 240, NULL, '{}'::jsonb, true, false, 14, NOW(), NOW());
--> statement-breakpoint

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000041, 'Sakura Wind', 'Cherry blossoms blow across your profile in a gentle breeze.', 'profile_effect', 'profile_effects', 190, NULL, '{}'::jsonb, true, false, 15, NOW(), NOW());
--> statement-breakpoint

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000042, 'Neon Grid', 'An 80s-inspired neon wireframe grid stretches into the distance.', 'profile_effect', 'profile_effects', 200, NULL, '{}'::jsonb, true, false, 16, NOW(), NOW());
--> statement-breakpoint

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000043, 'Galaxy Spin', 'A slowly rotating galaxy fills your profile background.', 'profile_effect', 'profile_effects', 300, NULL, '{}'::jsonb, true, true, 17, NOW(), NOW());
--> statement-breakpoint

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000044, 'Pixel Rain', 'Colorful pixel blocks rain down in a retro cascade.', 'profile_effect', 'profile_effects', 140, NULL, '{}'::jsonb, true, false, 18, NOW(), NOW());
--> statement-breakpoint

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000045, 'Prism Light', 'Light refracts into a rainbow prism across your profile.', 'profile_effect', 'profile_effects', 220, NULL, '{}'::jsonb, true, false, 19, NOW(), NOW());
--> statement-breakpoint

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000046, 'Volcanic Ash', 'Glowing embers and ash particles rise from the bottom.', 'profile_effect', 'profile_effects', 200, NULL, '{}'::jsonb, true, false, 20, NOW(), NOW());
--> statement-breakpoint

-- ============================================================================
-- Nameplates (continued from IDs 1000000000000013-1000000000000018)
-- ============================================================================

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000047, 'Ocean Breeze', 'A calm teal to aquamarine gradient inspired by the sea.', 'nameplate', 'nameplates', 100, NULL, '{}'::jsonb, true, false, 7, NOW(), NOW());
--> statement-breakpoint

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000048, 'Neon Pink', 'A vibrant hot pink to magenta gradient.', 'nameplate', 'nameplates', 120, NULL, '{}'::jsonb, true, true, 8, NOW(), NOW());
--> statement-breakpoint

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000049, 'Cyber Purple', 'A deep electric purple to indigo gradient.', 'nameplate', 'nameplates', 100, NULL, '{}'::jsonb, true, false, 9, NOW(), NOW());
--> statement-breakpoint

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000050, 'Mint Fresh', 'A cool mint green to seafoam gradient.', 'nameplate', 'nameplates', 80, NULL, '{}'::jsonb, true, false, 10, NOW(), NOW());
--> statement-breakpoint

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000051, 'Rose Gold', 'A luxurious rose gold to champagne gradient.', 'nameplate', 'nameplates', 150, NULL, '{}'::jsonb, true, true, 11, NOW(), NOW());
--> statement-breakpoint

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000052, 'Carbon Fiber', 'A dark carbon fiber pattern with subtle reflections.', 'nameplate', 'nameplates', 130, NULL, '{}'::jsonb, true, false, 12, NOW(), NOW());
--> statement-breakpoint

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000053, 'Autumn Warmth', 'A warm amber to russet brown gradient evoking fall.', 'nameplate', 'nameplates', 100, NULL, '{}'::jsonb, true, false, 13, NOW(), NOW());
--> statement-breakpoint

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000054, 'Electric Blue', 'A vivid electric blue to cyan gradient.', 'nameplate', 'nameplates', 100, NULL, '{}'::jsonb, true, false, 14, NOW(), NOW());
--> statement-breakpoint

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000055, 'Lavender Dream', 'A soft lavender to periwinkle pastel gradient.', 'nameplate', 'nameplates', 90, NULL, '{}'::jsonb, true, false, 15, NOW(), NOW());
--> statement-breakpoint

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000056, 'Dark Matter', 'An ultra-dark gradient with subtle purple nebula hints.', 'nameplate', 'nameplates', 140, NULL, '{}'::jsonb, true, false, 16, NOW(), NOW());
--> statement-breakpoint

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000057, 'Sunset Strip', 'A warm gradient inspired by California sunsets.', 'nameplate', 'nameplates', 110, NULL, '{}'::jsonb, true, false, 17, NOW(), NOW());
--> statement-breakpoint

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000058, 'Chrome Silver', 'A sleek chrome silver to gunmetal gradient.', 'nameplate', 'nameplates', 120, NULL, '{}'::jsonb, true, false, 18, NOW(), NOW());
--> statement-breakpoint

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000059, 'Toxic Green', 'A radioactive green to yellow-green gradient.', 'nameplate', 'nameplates', 100, NULL, '{}'::jsonb, true, false, 19, NOW(), NOW());
--> statement-breakpoint

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000060, 'Prismatic', 'A full spectrum rainbow gradient that shifts color.', 'nameplate', 'nameplates', 250, NULL, '{}'::jsonb, true, true, 20, NOW(), NOW());
