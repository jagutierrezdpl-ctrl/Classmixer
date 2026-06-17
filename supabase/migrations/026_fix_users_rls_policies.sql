-- Fix 3 security issues on public.users:
-- 1. RLS policies referenced user_metadata (user-editable), replaced with
--    helper functions that read from the DB table itself (service-role managed).
-- 2. handle_new_user trigger defaulted role='admin' from user_metadata — a user
--    calling signUp() directly could get admin access. Changed to role='pending'.
-- 3. users_update policy allowed self-updates (id = auth.uid()), enabling privilege
--    escalation via PostgREST. Restricted to admins only (all real updates go
--    through service client which bypasses RLS anyway).

-- ─── Helper functions (CREATE OR REPLACE = idempotent) ───────────────────────

create or replace function public.current_center_id()
returns uuid language sql stable security definer
set search_path = public as $$
  select center_id from public.users where id = auth.uid()
$$;

create or replace function public.is_superadmin()
returns boolean language sql stable security definer
set search_path = public as $$
  select exists(select 1 from public.users where id = auth.uid() and role = 'superadmin')
$$;

create or replace function public.is_admin_or_superadmin()
returns boolean language sql stable security definer
set search_path = public as $$
  select exists(select 1 from public.users where id = auth.uid() and role in ('superadmin','admin'))
$$;

-- ─── Enable RLS (idempotent) ─────────────────────────────────────────────────

alter table public.users enable row level security;

-- ─── Drop the 4 flagged policies ─────────────────────────────────────────────

drop policy if exists "users_select" on public.users;
drop policy if exists "users_insert" on public.users;
drop policy if exists "users_update" on public.users;
drop policy if exists "users_delete" on public.users;

-- ─── Recreate without user_metadata references ───────────────────────────────

create policy "users_select" on public.users for select using (
  id = auth.uid()
  or center_id = current_center_id()
  or is_superadmin()
);

create policy "users_insert" on public.users for insert with check (
  center_id = current_center_id() or is_superadmin()
);

-- No self-service updates via PostgREST: prevents role/center_id escalation.
-- App updates go through service client (bypasses RLS) so this doesn't affect
-- any existing functionality.
create policy "users_update" on public.users for update
  using (
    is_admin_or_superadmin() and center_id = current_center_id()
  )
  with check (
    is_admin_or_superadmin() and center_id = current_center_id()
  );

create policy "users_delete" on public.users for delete using (
  (is_admin_or_superadmin() and center_id = current_center_id() and id <> auth.uid())
  or is_superadmin()
);

-- ─── Fix handle_new_user trigger ─────────────────────────────────────────────
-- Old version read role and center_id from raw_user_meta_data, which is
-- user-editable at signUp time. Any user could call supabase.auth.signUp()
-- with { data: { role: "admin", center_id: "<any uuid>" } } and get admin access.
--
-- New version: role defaults to 'pending', center_id to null.
-- API routes (register, invite) immediately follow up with a service-client
-- upsert that sets the real role and center_id, so behavior is unchanged
-- for legitimate flows. The ON CONFLICT DO NOTHING avoids errors if the API
-- route's upsert runs first.

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.users (id, email, name, role, center_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    'pending',
    null
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
