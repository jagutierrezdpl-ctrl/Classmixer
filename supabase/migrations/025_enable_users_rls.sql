-- Fix: enable RLS on public.users. The 4 policies (users_select, users_insert,
-- users_update, users_delete) already exist but were silently bypassed because
-- RLS was not enabled on the table. Idempotent: safe to run even if already enabled.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
