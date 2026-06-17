-- Fix 16 security warnings from Supabase linter (all WARN level):
--
-- A) function_search_path_mutable (×3): set_updated_at, handle_new_user,
--    assign_student_external_id lack a fixed search_path — a malicious schema
--    object with the same name as a built-in could hijack execution.
--
-- B) rls_policy_always_true (×2): tokens_update USING (true) lets any user
--    update any questionnaire token; responses_insert WITH CHECK (true) lets
--    anyone insert responses. Both are handled safely by service-client API
--    routes so restricting the RLS policy costs nothing.
--
-- C) anon/authenticated_security_definer_function_executable (×10): five
--    SECURITY DEFINER helper functions (current_center_id, is_superadmin,
--    is_admin_or_superadmin, handle_new_user, rls_auto_enable) are callable
--    via /rest/v1/rpc/ without signing in. Fix: REVOKE EXECUTE from anon and
--    authenticated — they are only ever called internally by RLS policies and
--    triggers, never as public RPCs.

-- ─── A. Fix mutable search_path on trigger/helper functions ──────────────────

create or replace function public.set_updated_at()
returns trigger language plpgsql
set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Also fixes the search_path warning introduced in migration 026 for handle_new_user
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public as $$
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

create or replace function public.assign_student_external_id()
returns trigger language plpgsql
set search_path = public as $$
declare
  new_counter integer;
begin
  if new.external_id is null or new.external_id = '' then
    update public.centers
    set student_counter = student_counter + 1
    where id = new.center_id
    returning student_counter into new_counter;

    new.external_id := lpad(new_counter::text, 4, '0');
  end if;
  return new;
end;
$$;

-- ─── B. Tighten overly-permissive RLS policies ───────────────────────────────

-- tokens_update: was USING (true) — anyone could update any token via PostgREST
drop policy if exists "tokens_update" on public.questionnaire_tokens;
create policy "tokens_update" on public.questionnaire_tokens for update using (
  exists (
    select 1 from public.processes p
    where p.id = process_id and p.center_id = public.current_center_id()
  )
  and public.is_admin_or_superadmin()
);

-- responses_insert: was WITH CHECK (true) — anyone could insert responses directly.
-- The actual student insert goes through service client (bypasses RLS) so this
-- restriction has zero impact on app functionality.
drop policy if exists "responses_insert" on public.responses;
create policy "responses_insert" on public.responses for insert with check (
  exists (
    select 1 from public.processes p
    where p.id = process_id and p.center_id = public.current_center_id()
  )
);

-- ─── C. Revoke public RPC access to internal SECURITY DEFINER functions ──────
-- These functions are only used as helpers inside RLS policies and triggers.
-- They should never be callable as public REST endpoints.

revoke execute on function public.current_center_id() from anon, authenticated;
revoke execute on function public.is_superadmin() from anon, authenticated;
revoke execute on function public.is_admin_or_superadmin() from anon, authenticated;
revoke execute on function public.handle_new_user() from anon, authenticated;

-- rls_auto_enable was created manually (not in any migration file).
-- Revoke its public RPC access regardless of what it does internally.
revoke execute on function public.rls_auto_enable() from anon, authenticated;
