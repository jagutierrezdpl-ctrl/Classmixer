-- Cooperative learning groups module

create table if not exists group_sessions (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null references processes(id) on delete cascade,
  class_name text not null,           -- e.g. "6PA"
  name text not null,                  -- e.g. "Grupos de Octubre"
  num_groups int not null default 4,
  balance_gender boolean not null default true,
  balance_academic boolean not null default true,
  use_sociogram boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists group_sets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references group_sessions(id) on delete cascade,
  name text not null default 'Grupos',
  score_total numeric,
  status text not null default 'generado',    -- generado | aprobado
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists group_assignments (
  id uuid primary key default gen_random_uuid(),
  group_set_id uuid not null references group_sets(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  group_number int not null,
  role text,                          -- coordinador | secretario | portavoz | revisor | null
  created_at timestamptz not null default now()
);

-- RLS
alter table group_sessions enable row level security;
alter table group_sets enable row level security;
alter table group_assignments enable row level security;

-- group_sessions: readable by users of the same center (via process→center_id)
create policy "gs_read" on group_sessions for select using (
  exists (
    select 1 from processes p
    join users u on u.center_id = p.center_id
    where p.id = group_sessions.process_id and u.id = auth.uid()
  )
);
create policy "gs_insert" on group_sessions for insert with check (
  exists (
    select 1 from processes p
    join users u on u.center_id = p.center_id
    where p.id = group_sessions.process_id and u.id = auth.uid()
  )
);
create policy "gs_update" on group_sessions for update using (
  exists (
    select 1 from processes p
    join users u on u.center_id = p.center_id
    where p.id = group_sessions.process_id and u.id = auth.uid()
  )
);
create policy "gs_delete" on group_sessions for delete using (
  exists (
    select 1 from processes p
    join users u on u.center_id = p.center_id
    where p.id = group_sessions.process_id and u.id = auth.uid()
  )
);

-- group_sets policies (via group_sessions→processes→center)
create policy "gset_read" on group_sets for select using (
  exists (
    select 1 from group_sessions gs
    join processes p on p.id = gs.process_id
    join users u on u.center_id = p.center_id
    where gs.id = group_sets.session_id and u.id = auth.uid()
  )
);
create policy "gset_insert" on group_sets for insert with check (
  exists (
    select 1 from group_sessions gs
    join processes p on p.id = gs.process_id
    join users u on u.center_id = p.center_id
    where gs.id = group_sets.session_id and u.id = auth.uid()
  )
);
create policy "gset_update" on group_sets for update using (
  exists (
    select 1 from group_sessions gs
    join processes p on p.id = gs.process_id
    join users u on u.center_id = p.center_id
    where gs.id = group_sets.session_id and u.id = auth.uid()
  )
);
create policy "gset_delete" on group_sets for delete using (
  exists (
    select 1 from group_sessions gs
    join processes p on p.id = gs.process_id
    join users u on u.center_id = p.center_id
    where gs.id = group_sets.session_id and u.id = auth.uid()
  )
);

-- group_assignments policies
create policy "ga_read" on group_assignments for select using (
  exists (
    select 1 from group_sets gset
    join group_sessions gs on gs.id = gset.session_id
    join processes p on p.id = gs.process_id
    join users u on u.center_id = p.center_id
    where gset.id = group_assignments.group_set_id and u.id = auth.uid()
  )
);
create policy "ga_insert" on group_assignments for insert with check (
  exists (
    select 1 from group_sets gset
    join group_sessions gs on gs.id = gset.session_id
    join processes p on p.id = gs.process_id
    join users u on u.center_id = p.center_id
    where gset.id = group_assignments.group_set_id and u.id = auth.uid()
  )
);
create policy "ga_update" on group_assignments for update using (
  exists (
    select 1 from group_sets gset
    join group_sessions gs on gs.id = gset.session_id
    join processes p on p.id = gs.process_id
    join users u on u.center_id = p.center_id
    where gset.id = group_assignments.group_set_id and u.id = auth.uid()
  )
);
create policy "ga_delete" on group_assignments for delete using (
  exists (
    select 1 from group_sets gset
    join group_sessions gs on gs.id = gset.session_id
    join processes p on p.id = gs.process_id
    join users u on u.center_id = p.center_id
    where gset.id = group_assignments.group_set_id and u.id = auth.uid()
  )
);
