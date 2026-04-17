-- Remove Stripe-related tables (no real-money payments)
DROP TABLE IF EXISTS "purchases";
DROP TABLE IF EXISTS "stripe_customers";
