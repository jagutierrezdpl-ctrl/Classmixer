-- Reglas para grupos cooperativos: separar o mantener juntos alumnos concretos.
-- Son independientes de las reglas de mezcla de clases (tabla rules).

create table if not exists cooperative_rules (
  id          uuid primary key default uuid_generate_v4(),
  session_id  uuid not null references group_sessions(id) on delete cascade,
  rule_type   text not null check (rule_type in ('must_separate', 'must_keep_together')),
  description text,
  active      boolean not null default true,
  created_by  uuid references users(id) on delete set null,
  created_at  timestamptz default now()
);

create table if not exists cooperative_rule_students (
  id         uuid primary key default uuid_generate_v4(),
  rule_id    uuid not null references cooperative_rules(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  unique (rule_id, student_id)
);

create index if not exists idx_coop_rules_session on cooperative_rules(session_id);
create index if not exists idx_coop_rule_students_rule on cooperative_rule_students(rule_id);

alter table cooperative_rules         enable row level security;
alter table cooperative_rule_students enable row level security;

-- Access via session → process → center_id
create policy "coop_rules_select" on cooperative_rules for select
  using (
    exists (
      select 1 from group_sessions gs
      join processes p on p.id = gs.process_id
      where gs.id = session_id
        and p.center_id = current_center_id()
    )
  );

create policy "coop_rules_insert" on cooperative_rules for insert
  with check (
    exists (
      select 1 from group_sessions gs
      join processes p on p.id = gs.process_id
      where gs.id = session_id
        and p.center_id = current_center_id()
    )
  );

create policy "coop_rules_update" on cooperative_rules for update
  using (
    exists (
      select 1 from group_sessions gs
      join processes p on p.id = gs.process_id
      where gs.id = session_id
        and p.center_id = current_center_id()
    )
  );

create policy "coop_rules_delete" on cooperative_rules for delete
  using (
    exists (
      select 1 from group_sessions gs
      join processes p on p.id = gs.process_id
      where gs.id = session_id
        and p.center_id = current_center_id()
    )
  );

create policy "coop_rule_students_select" on cooperative_rule_students for select
  using (
    exists (
      select 1 from cooperative_rules cr
      join group_sessions gs on gs.id = cr.session_id
      join processes p on p.id = gs.process_id
      where cr.id = rule_id
        and p.center_id = current_center_id()
    )
  );

create policy "coop_rule_students_insert" on cooperative_rule_students for insert
  with check (
    exists (
      select 1 from cooperative_rules cr
      join group_sessions gs on gs.id = cr.session_id
      join processes p on p.id = gs.process_id
      where cr.id = rule_id
        and p.center_id = current_center_id()
    )
  );

create policy "coop_rule_students_delete" on cooperative_rule_students for delete
  using (
    exists (
      select 1 from cooperative_rules cr
      join group_sessions gs on gs.id = cr.session_id
      join processes p on p.id = gs.process_id
      where cr.id = rule_id
        and p.center_id = current_center_id()
    )
  );
