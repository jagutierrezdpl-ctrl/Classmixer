-- ─── Row Level Security ───────────────────────────────────────────────────────
-- Run this AFTER migrations 001 and 002.
-- Uses auth.uid() from Supabase Auth JWT.
-- The server client (with cookies) automatically passes the user session.

-- Helper: get current user's center_id
create or replace function public.current_center_id()
returns uuid language sql stable security definer
set search_path = public as $$
  select center_id from public.users where id = auth.uid()
$$;

-- Helper: check if current user is superadmin
create or replace function public.is_superadmin()
returns boolean language sql stable security definer
set search_path = public as $$
  select exists(select 1 from public.users where id = auth.uid() and role = 'superadmin')
$$;

-- Helper: check if current user is admin or superadmin in their center
create or replace function public.is_admin_or_superadmin()
returns boolean language sql stable security definer
set search_path = public as $$
  select exists(select 1 from public.users where id = auth.uid() and role in ('superadmin','admin'))
$$;

-- ─── centers ──────────────────────────────────────────────────────────────────
alter table centers enable row level security;

create policy "centers_select" on centers for select using (
  id = current_center_id() or is_superadmin()
);
create policy "centers_insert" on centers for insert with check (is_superadmin());
create policy "centers_update" on centers for update using (
  id = current_center_id() or is_superadmin()
);
create policy "centers_delete" on centers for delete using (is_superadmin());

-- ─── users ────────────────────────────────────────────────────────────────────
alter table users enable row level security;

create policy "users_select" on users for select using (
  id = auth.uid()
  or center_id = current_center_id()
  or is_superadmin()
);
create policy "users_insert" on users for insert with check (
  center_id = current_center_id() or is_superadmin()
);
create policy "users_update" on users for update using (
  id = auth.uid()
  or (is_admin_or_superadmin() and center_id = current_center_id())
);
create policy "users_delete" on users for delete using (
  (is_admin_or_superadmin() and center_id = current_center_id() and id <> auth.uid())
  or is_superadmin()
);

-- ─── processes ────────────────────────────────────────────────────────────────
alter table processes enable row level security;

create policy "processes_select" on processes for select using (
  center_id = current_center_id()
);
create policy "processes_insert" on processes for insert with check (
  center_id = current_center_id() and is_admin_or_superadmin()
);
create policy "processes_update" on processes for update using (
  center_id = current_center_id() and is_admin_or_superadmin()
);
create policy "processes_delete" on processes for delete using (
  center_id = current_center_id() and is_admin_or_superadmin()
);

-- ─── students ─────────────────────────────────────────────────────────────────
alter table students enable row level security;

create policy "students_select" on students for select using (
  exists (select 1 from processes p where p.id = process_id and p.center_id = current_center_id())
);
create policy "students_insert" on students for insert with check (
  exists (select 1 from processes p where p.id = process_id and p.center_id = current_center_id())
  and is_admin_or_superadmin()
);
create policy "students_update" on students for update using (
  exists (select 1 from processes p where p.id = process_id and p.center_id = current_center_id())
  and is_admin_or_superadmin()
);
create policy "students_delete" on students for delete using (
  exists (select 1 from processes p where p.id = process_id and p.center_id = current_center_id())
  and is_admin_or_superadmin()
);

-- ─── questionnaire_settings ───────────────────────────────────────────────────
alter table questionnaire_settings enable row level security;

create policy "qs_select" on questionnaire_settings for select using (
  exists (select 1 from processes p where p.id = process_id and p.center_id = current_center_id())
);
create policy "qs_insert" on questionnaire_settings for insert with check (
  exists (select 1 from processes p where p.id = process_id and p.center_id = current_center_id())
  and is_admin_or_superadmin()
);
create policy "qs_update" on questionnaire_settings for update using (
  exists (select 1 from processes p where p.id = process_id and p.center_id = current_center_id())
  and is_admin_or_superadmin()
);

-- ─── questionnaire_tokens ────────────────────────────────────────────────────
alter table questionnaire_tokens enable row level security;

-- Tokens are public for reading (needed for /q/[token] route)
create policy "tokens_select_own" on questionnaire_tokens for select using (true);
create policy "tokens_insert" on questionnaire_tokens for insert with check (
  exists (select 1 from processes p where p.id = process_id and p.center_id = current_center_id())
  and is_admin_or_superadmin()
);
create policy "tokens_update" on questionnaire_tokens for update using (true);

-- ─── responses ────────────────────────────────────────────────────────────────
alter table responses enable row level security;

create policy "responses_select" on responses for select using (
  exists (select 1 from processes p where p.id = process_id and p.center_id = current_center_id())
);
-- Responses are inserted via API (anon student uses token), so we keep insert open
-- but validate via token in the API route (not relying solely on RLS here)
create policy "responses_insert" on responses for insert with check (true);

-- ─── rules & rule_students ────────────────────────────────────────────────────
alter table rules enable row level security;

create policy "rules_select" on rules for select using (
  exists (select 1 from processes p where p.id = process_id and p.center_id = current_center_id())
);
create policy "rules_insert" on rules for insert with check (
  exists (select 1 from processes p where p.id = process_id and p.center_id = current_center_id())
);
create policy "rules_update" on rules for update using (
  exists (select 1 from processes p where p.id = process_id and p.center_id = current_center_id())
);
create policy "rules_delete" on rules for delete using (
  exists (select 1 from processes p where p.id = process_id and p.center_id = current_center_id())
);

alter table rule_students enable row level security;

create policy "rule_students_select" on rule_students for select using (
  exists (
    select 1 from rules r
    join processes p on p.id = r.process_id
    where r.id = rule_id and p.center_id = current_center_id()
  )
);
create policy "rule_students_insert" on rule_students for insert with check (
  exists (
    select 1 from rules r
    join processes p on p.id = r.process_id
    where r.id = rule_id and p.center_id = current_center_id()
  )
);
create policy "rule_students_delete" on rule_students for delete using (
  exists (
    select 1 from rules r
    join processes p on p.id = r.process_id
    where r.id = rule_id and p.center_id = current_center_id()
  )
);

-- ─── proposals ────────────────────────────────────────────────────────────────
alter table proposals enable row level security;

create policy "proposals_select" on proposals for select using (
  exists (select 1 from processes p where p.id = process_id and p.center_id = current_center_id())
);
create policy "proposals_insert" on proposals for insert with check (
  exists (select 1 from processes p where p.id = process_id and p.center_id = current_center_id())
  and is_admin_or_superadmin()
);
create policy "proposals_update" on proposals for update using (
  exists (select 1 from processes p where p.id = process_id and p.center_id = current_center_id())
  and is_admin_or_superadmin()
);

-- ─── proposal_assignments & proposal_metrics ─────────────────────────────────
alter table proposal_assignments enable row level security;

create policy "pa_select" on proposal_assignments for select using (
  exists (
    select 1 from proposals pr
    join processes p on p.id = pr.process_id
    where pr.id = proposal_id and p.center_id = current_center_id()
  )
);
create policy "pa_insert" on proposal_assignments for insert with check (
  exists (
    select 1 from proposals pr
    join processes p on p.id = pr.process_id
    where pr.id = proposal_id and p.center_id = current_center_id()
  )
);
create policy "pa_delete" on proposal_assignments for delete using (
  exists (
    select 1 from proposals pr
    join processes p on p.id = pr.process_id
    where pr.id = proposal_id and p.center_id = current_center_id()
  )
);

alter table proposal_metrics enable row level security;

create policy "pm_select" on proposal_metrics for select using (
  exists (
    select 1 from proposals pr
    join processes p on p.id = pr.process_id
    where pr.id = proposal_id and p.center_id = current_center_id()
  )
);
create policy "pm_insert" on proposal_metrics for insert with check (
  exists (
    select 1 from proposals pr
    join processes p on p.id = pr.process_id
    where pr.id = proposal_id and p.center_id = current_center_id()
  )
);

-- ─── sociogram_metrics ────────────────────────────────────────────────────────
alter table sociogram_metrics enable row level security;

create policy "sm_select" on sociogram_metrics for select using (
  exists (select 1 from processes p where p.id = process_id and p.center_id = current_center_id())
);
create policy "sm_insert" on sociogram_metrics for insert with check (
  exists (select 1 from processes p where p.id = process_id and p.center_id = current_center_id())
);
create policy "sm_upsert" on sociogram_metrics for update using (
  exists (select 1 from processes p where p.id = process_id and p.center_id = current_center_id())
);

-- ─── audit_logs ───────────────────────────────────────────────────────────────
alter table audit_logs enable row level security;

create policy "audit_select" on audit_logs for select using (
  center_id = current_center_id() or is_superadmin()
);
create policy "audit_insert" on audit_logs for insert with check (
  center_id = current_center_id()
);

-- ─── process_tutors ───────────────────────────────────────────────────────────
alter table process_tutors enable row level security;

create policy "pt_select" on process_tutors for select using (
  exists (select 1 from processes p where p.id = process_id and p.center_id = current_center_id())
);
create policy "pt_insert" on process_tutors for insert with check (
  exists (select 1 from processes p where p.id = process_id and p.center_id = current_center_id())
  and is_admin_or_superadmin()
);
create policy "pt_delete" on process_tutors for delete using (
  exists (select 1 from processes p where p.id = process_id and p.center_id = current_center_id())
  and is_admin_or_superadmin()
);
