-- NOTE:
-- `0012_ambitious_vengeance.sql` already contains the beta bug report inbox enum/table DDL.
-- This migration was accidentally duplicated and caused local fresh resets to fail
-- with `type "beta_bug_report_status" already exists`.
--
-- Keep this migration as a no-op to preserve migration history ordering for
-- environments where `0013` has already been recorded.
SELECT 1;--> statement-breakpoint
