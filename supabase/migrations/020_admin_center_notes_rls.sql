-- Migration 020: Enable RLS on admin_center_notes
-- No policies = zero direct access via anon/authenticated keys.
-- All access goes through the API which uses the service role (bypasses RLS).

ALTER TABLE admin_center_notes ENABLE ROW LEVEL SECURITY;
