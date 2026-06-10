-- ─── Licenses ────────────────────────────────────────────────────────────────
create table if not exists licenses (
  id          uuid primary key default uuid_generate_v4(),
  center_id   uuid unique not null references centers(id) on delete cascade,
  plan        text not null default 'free'
                check (plan in ('free','basic','pro','enterprise')),
  max_processes  int,     -- null = ilimitado
  max_students   int,     -- null = ilimitado (por proceso)
  max_users      int,     -- null = ilimitado
  valid_until    timestamptz, -- null = sin caducidad
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Default free license for existing centers
insert into licenses (center_id, plan, max_processes, max_students, max_users)
select id, 'free', 1, 60, 3 from centers
on conflict (center_id) do nothing;

-- RLS
alter table licenses enable row level security;

create policy "licenses_select" on licenses for select using (
  center_id = public.current_center_id() or public.is_superadmin()
);
create policy "licenses_insert" on licenses for insert with check (public.is_superadmin());
create policy "licenses_update" on licenses for update using (public.is_superadmin());
create policy "licenses_delete" on licenses for delete using (public.is_superadmin());
