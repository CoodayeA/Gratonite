-- Seed shop_items with initial cosmetic items
-- Avatar Decorations, Profile Effects, and Nameplates

-- ============================================================================
-- Avatar Decorations (type: 'avatar_decoration', category: 'avatar_decorations')
-- ============================================================================

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000001, 'Celestial Ring', 'A glowing starfield border that wraps your avatar in cosmic light.', 'avatar_decoration', 'avatar_decorations', 150, NULL, '{}'::jsonb, true, true, 1, NOW(), NOW());
--> statement-breakpoint

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000002, 'Neon Pulse', 'An animated neon outline that pulses with vibrant energy.', 'avatar_decoration', 'avatar_decorations', 200, NULL, '{}'::jsonb, true, true, 2, NOW(), NOW());
--> statement-breakpoint

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000003, 'Frost Frame', 'An icy crystalline border with frozen edges.', 'avatar_decoration', 'avatar_decorations', 120, NULL, '{}'::jsonb, true, false, 3, NOW(), NOW());
--> statement-breakpoint

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000004, 'Shadow Aura', 'A dark mist effect that swirls around your avatar.', 'avatar_decoration', 'avatar_decorations', 100, NULL, '{}'::jsonb, true, false, 4, NOW(), NOW());
--> statement-breakpoint

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000005, 'Golden Crown', 'A regal gold frame fit for royalty.', 'avatar_decoration', 'avatar_decorations', 250, NULL, '{}'::jsonb, true, true, 5, NOW(), NOW());
--> statement-breakpoint

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000006, 'Pixel Grid', 'A retro pixelated border for a classic look.', 'avatar_decoration', 'avatar_decorations', 80, NULL, '{}'::jsonb, true, false, 6, NOW(), NOW());
--> statement-breakpoint

-- ============================================================================
-- Profile Effects (type: 'profile_effect', category: 'profile_effects')
-- ============================================================================

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000007, 'Aurora Waves', 'Northern lights shimmer across your profile.', 'profile_effect', 'profile_effects', 300, NULL, '{}'::jsonb, true, true, 1, NOW(), NOW());
--> statement-breakpoint

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000008, 'Cherry Blossom', 'Delicate petals gently falling across your profile.', 'profile_effect', 'profile_effects', 200, NULL, '{}'::jsonb, true, false, 2, NOW(), NOW());
--> statement-breakpoint

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000009, 'Starfall', 'Shooting stars streak across your profile background.', 'profile_effect', 'profile_effects', 250, NULL, '{}'::jsonb, true, true, 3, NOW(), NOW());
--> statement-breakpoint

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000010, 'Ember Glow', 'Warm firefly particles floating gently around your profile.', 'profile_effect', 'profile_effects', 180, NULL, '{}'::jsonb, true, false, 4, NOW(), NOW());
--> statement-breakpoint

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000011, 'Raindrop', 'A gentle rain effect with soft droplets.', 'profile_effect', 'profile_effects', 150, NULL, '{}'::jsonb, true, false, 5, NOW(), NOW());
--> statement-breakpoint

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000012, 'Cosmic Dust', 'Floating space particles drifting across your profile.', 'profile_effect', 'profile_effects', 220, NULL, '{}'::jsonb, true, false, 6, NOW(), NOW());
--> statement-breakpoint

-- ============================================================================
-- Nameplates (type: 'nameplate', category: 'nameplates')
-- ============================================================================

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000013, 'Midnight Gradient', 'A deep blue to purple gradient nameplate.', 'nameplate', 'nameplates', 100, NULL, '{}'::jsonb, true, true, 1, NOW(), NOW());
--> statement-breakpoint

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000014, 'Sunrise Blaze', 'A warm orange to gold gradient nameplate.', 'nameplate', 'nameplates', 100, NULL, '{}'::jsonb, true, false, 2, NOW(), NOW());
--> statement-breakpoint

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000015, 'Arctic Frost', 'A crisp white to ice blue gradient nameplate.', 'nameplate', 'nameplates', 100, NULL, '{}'::jsonb, true, false, 3, NOW(), NOW());
--> statement-breakpoint

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000016, 'Emerald Forest', 'A lush green nature-inspired gradient nameplate.', 'nameplate', 'nameplates', 100, NULL, '{}'::jsonb, true, false, 4, NOW(), NOW());
--> statement-breakpoint

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000017, 'Volcanic Core', 'A fiery red to dark gradient nameplate.', 'nameplate', 'nameplates', 120, NULL, '{}'::jsonb, true, false, 5, NOW(), NOW());
--> statement-breakpoint

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000018, 'Holographic', 'A rainbow shimmer nameplate that shifts colors.', 'nameplate', 'nameplates', 200, NULL, '{}'::jsonb, true, true, 6, NOW(), NOW());
