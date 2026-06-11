-- Drop legacy RLS policies created in migration 001 that were superseded by 003.
-- Migration 003 creates more granular policies with the same intent but better names.
-- Running both sets simultaneously causes redundant policy evaluations.

DROP POLICY IF EXISTS "users_read_own_center"       ON centers;
DROP POLICY IF EXISTS "users_read_own"               ON users;
DROP POLICY IF EXISTS "admins_read_center_users"     ON users;
DROP POLICY IF EXISTS "users_read_center_processes"  ON processes;
DROP POLICY IF EXISTS "admins_manage_processes"      ON processes;
DROP POLICY IF EXISTS "users_read_students"          ON students;
DROP POLICY IF EXISTS "admins_manage_students"       ON students;
DROP POLICY IF EXISTS "public_read_token"            ON questionnaire_tokens;
DROP POLICY IF EXISTS "admins_read_responses"        ON responses;
DROP POLICY IF EXISTS "users_read_rules"             ON rules;
DROP POLICY IF EXISTS "admins_manage_rules"          ON rules;
DROP POLICY IF EXISTS "admins_manage_proposals"      ON proposals;
DROP POLICY IF EXISTS "authorized_read_sociogram"    ON sociogram_metrics;
