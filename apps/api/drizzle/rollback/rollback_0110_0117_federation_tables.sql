-- Rollback: Drop all federation tables (0110-0117)
-- WARNING: This deletes all federation data irreversibly.
DROP TABLE IF EXISTS "account_imports" CASCADE;
DROP TABLE IF EXISTS "instance_blocks" CASCADE;
DROP TABLE IF EXISTS "federation_activities" CASCADE;
DROP TABLE IF EXISTS "guild_replicas" CASCADE;
DROP TABLE IF EXISTS "remote_guilds" CASCADE;
DROP TABLE IF EXISTS "remote_users" CASCADE;
DROP TABLE IF EXISTS "federation_key_pairs" CASCADE;
DROP TABLE IF EXISTS "federated_instances" CASCADE;
