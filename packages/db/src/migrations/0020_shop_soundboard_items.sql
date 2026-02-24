-- Add 15 soundboard sound items to the shop catalog
-- IDs 1000000000000061 through 1000000000000075

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000061, 'Airhorn', 'The classic airhorn blast.', 'soundboard_sound', 'soundboard', 100, NULL, '{"durationMs": 3000}'::jsonb, true, true, 1, NOW(), NOW());
--> statement-breakpoint

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000062, 'Sad Trombone', 'Wah wah waaah.', 'soundboard_sound', 'soundboard', 80, NULL, '{"durationMs": 4000}'::jsonb, true, false, 2, NOW(), NOW());
--> statement-breakpoint

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000063, 'Drum Roll', 'A suspenseful drum roll building to a cymbal crash.', 'soundboard_sound', 'soundboard', 90, NULL, '{"durationMs": 5000}'::jsonb, true, false, 3, NOW(), NOW());
--> statement-breakpoint

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000064, 'Crickets', 'Awkward silence filled by chirping crickets.', 'soundboard_sound', 'soundboard', 60, NULL, '{"durationMs": 4000}'::jsonb, true, false, 4, NOW(), NOW());
--> statement-breakpoint

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000065, 'Rimshot', 'Ba dum tss! The classic joke punctuation.', 'soundboard_sound', 'soundboard', 70, NULL, '{"durationMs": 2000}'::jsonb, true, true, 5, NOW(), NOW());
--> statement-breakpoint

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000066, 'Victory Fanfare', 'A triumphant brass fanfare for wins.', 'soundboard_sound', 'soundboard', 150, NULL, '{"durationMs": 5000}'::jsonb, true, true, 6, NOW(), NOW());
--> statement-breakpoint

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000067, 'Fail Horn', 'A descending brass blat for spectacular fails.', 'soundboard_sound', 'soundboard', 80, NULL, '{"durationMs": 2500}'::jsonb, true, false, 7, NOW(), NOW());
--> statement-breakpoint

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000068, 'Applause', 'Enthusiastic crowd applause.', 'soundboard_sound', 'soundboard', 100, NULL, '{"durationMs": 5000}'::jsonb, true, false, 8, NOW(), NOW());
--> statement-breakpoint

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000069, 'Boing', 'A cartoon spring bounce sound effect.', 'soundboard_sound', 'soundboard', 50, NULL, '{"durationMs": 1500}'::jsonb, true, false, 9, NOW(), NOW());
--> statement-breakpoint

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000070, 'Record Scratch', 'A vinyl record scratch for sudden stops.', 'soundboard_sound', 'soundboard', 90, NULL, '{"durationMs": 2000}'::jsonb, true, false, 10, NOW(), NOW());
--> statement-breakpoint

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000071, 'Laser Pew', 'A retro sci-fi laser zap.', 'soundboard_sound', 'soundboard', 60, NULL, '{"durationMs": 1000}'::jsonb, true, false, 11, NOW(), NOW());
--> statement-breakpoint

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000072, 'Bruh', 'The quintessential bruh moment.', 'soundboard_sound', 'soundboard', 120, NULL, '{"durationMs": 1500}'::jsonb, true, true, 12, NOW(), NOW());
--> statement-breakpoint

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000073, 'Dramatic Chipmunk', 'Dun dun duuun! Dramatic reveal sting.', 'soundboard_sound', 'soundboard', 100, NULL, '{"durationMs": 3000}'::jsonb, true, false, 13, NOW(), NOW());
--> statement-breakpoint

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000074, 'Whoosh', 'A swooshing wind pass-by.', 'soundboard_sound', 'soundboard', 50, NULL, '{"durationMs": 1500}'::jsonb, true, false, 14, NOW(), NOW());
--> statement-breakpoint

INSERT INTO "shop_items" ("id", "name", "description", "type", "category", "price", "asset_hash", "metadata", "is_active", "is_featured", "sort_order", "created_at", "updated_at")
VALUES (1000000000000075, 'Ding', 'A clean bell ding notification sound.', 'soundboard_sound', 'soundboard', 40, NULL, '{"durationMs": 1000}'::jsonb, true, false, 15, NOW(), NOW());
