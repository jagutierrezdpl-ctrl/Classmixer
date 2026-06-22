-- ─────────────────────────────────────────────────────────────────────────────
-- 035 — Enable RLS on tables created in 034 that were missing it
-- ─────────────────────────────────────────────────────────────────────────────
-- The app backend exclusively accesses these tables via createServiceClient()
-- (service_role key, which bypasses RLS). Therefore no authenticated-role
-- policies are needed; enabling RLS is enough to block direct anon/authenticated
-- queries from the Supabase REST API or browser console.

ALTER TABLE public.sociogram_annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_notifications ENABLE ROW LEVEL SECURITY;
