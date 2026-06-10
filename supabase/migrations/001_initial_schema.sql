-- ─── Extensions ───────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── Centers ──────────────────────────────────────────────────────────────────
create table centers (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  address     text,
  city        text,
  country     text default 'España',
  created_at  timestamptz default now()
);

-- ─── Users (extends auth.users) ───────────────────────────────────────────────
create table users (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null unique,
  name        text not null,
  role        text not null default 'tutor'
                check (role in ('superadmin','admin','tutor','orientador','alumno')),
  center_id   uuid references centers(id) on delete cascade,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ─── Processes ────────────────────────────────────────────────────────────────
create table processes (
  id                      uuid primary key default uuid_generate_v4(),
  center_id               uuid not null references centers(id) on delete cascade,
  name                    text not null,
  school_year             text not null,
  source_level            text not null,
  target_level            text not null,
  source_groups           text[] not null default '{}',
  target_groups           text[] not null default '{}',
  target_class_count      int  not null default 2,
  min_class_size          int  not null default 20,
  max_class_size          int  not null default 30,
  status                  text not null default 'borrador'
                            check (status in (
                              'borrador','cuestionario_abierto','cuestionario_cerrado',
                              'en_analisis','propuestas_generadas','propuesta_seleccionada',
                              'cerrado','archivado'
                            )),
  questionnaire_deadline  timestamptz,
  created_by              uuid not null references users(id),
  created_at              timestamptz default now(),
  updated_at              timestamptz default now()
);

-- ─── Students ─────────────────────────────────────────────────────────────────
create table students (
  id              uuid primary key default uuid_generate_v4(),
  process_id      uuid not null references processes(id) on delete cascade,
  external_id     text not null,
  first_name      text not null,
  last_name       text not null,
  current_class   text not null,
  gender          text not null default 'No especificado'
                    check (gender in ('F','M','Otro','No especificado')),
  average_grade   numeric(4,2) not null default 5.0
                    check (average_grade >= 0 and average_grade <= 10),
  academic_level  text check (academic_level in ('Alto','Medio-alto','Medio','Medio-bajo','Bajo')),
  behavior_level  text check (behavior_level in ('Positiva','Normal','Seguimiento','Conflictiva')),
  needs_type      text check (needs_type in ('No','Sí','ACNEAE','NEE','Refuerzo','Altas capacidades','Observación interna')),
  observations    text,
  tutor           text,
  is_repeating    boolean default false,
  support_type    text,
  active          boolean default true,
  created_at      timestamptz default now(),
  unique (process_id, external_id)
);

-- ─── Questionnaire settings ───────────────────────────────────────────────────
create table questionnaire_settings (
  id                  uuid primary key default uuid_generate_v4(),
  process_id          uuid not null unique references processes(id) on delete cascade,
  friendship_enabled  boolean default true,
  friendship_min      int default 1,
  friendship_max      int default 5,
  work_enabled        boolean default false,
  work_min            int default 0,
  work_max            int default 3,
  emotional_enabled   boolean default false,
  emotional_min       int default 0,
  emotional_max       int default 3,
  negative_enabled    boolean default false,
  negative_max        int default 2,
  access_mode         text default 'token'
                        check (access_mode in ('token','google','open')),
  deadline            timestamptz
);

-- ─── Questionnaire tokens ─────────────────────────────────────────────────────
create table questionnaire_tokens (
  id            uuid primary key default uuid_generate_v4(),
  process_id    uuid not null references processes(id) on delete cascade,
  student_id    uuid not null references students(id) on delete cascade,
  token         text not null unique,
  used          boolean default false,
  completed_at  timestamptz,
  unique (process_id, student_id)
);

-- ─── Responses ────────────────────────────────────────────────────────────────
create table responses (
  id                    uuid primary key default uuid_generate_v4(),
  process_id            uuid not null references processes(id) on delete cascade,
  respondent_student_id uuid not null references students(id) on delete cascade,
  target_student_id     uuid not null references students(id) on delete cascade,
  relation_type         text not null
                          check (relation_type in ('friendship','work','emotional','negative')),
  weight                int not null default 1,
  created_at            timestamptz default now(),
  unique (process_id, respondent_student_id, target_student_id, relation_type)
);

-- ─── Rules ────────────────────────────────────────────────────────────────────
create table rules (
  id          uuid primary key default uuid_generate_v4(),
  process_id  uuid not null references processes(id) on delete cascade,
  rule_type   text not null
                check (rule_type in (
                  'must_separate','should_keep_together','must_keep_together',
                  'keep_at_least_one','max_from_group','lock_student_to_class',
                  'exclude_student','protect_vulnerable'
                )),
  priority    text not null default 'media'
                check (priority in ('obligatoria','alta','media','baja')),
  description text,
  target_class text,
  max_count   int,
  created_by  uuid not null references users(id),
  active      boolean default true,
  created_at  timestamptz default now()
);

-- ─── Rule students ────────────────────────────────────────────────────────────
create table rule_students (
  id          uuid primary key default uuid_generate_v4(),
  rule_id     uuid not null references rules(id) on delete cascade,
  student_id  uuid not null references students(id) on delete cascade,
  role        text,
  unique (rule_id, student_id)
);

-- ─── Proposals ────────────────────────────────────────────────────────────────
create table proposals (
  id              uuid primary key default uuid_generate_v4(),
  process_id      uuid not null references processes(id) on delete cascade,
  name            text not null,
  score_total     numeric(5,2) default 0,
  score_social    numeric(5,2) default 0,
  score_academic  numeric(5,2) default 0,
  score_gender    numeric(5,2) default 0,
  score_behavior  numeric(5,2) default 0,
  status          text default 'generada'
                    check (status in ('generada','editada','aprobada','descartada')),
  generated_at    timestamptz default now(),
  created_by      uuid references users(id)
);

-- ─── Proposal assignments ─────────────────────────────────────────────────────
create table proposal_assignments (
  id            uuid primary key default uuid_generate_v4(),
  proposal_id   uuid not null references proposals(id) on delete cascade,
  student_id    uuid not null references students(id) on delete cascade,
  target_class  text not null,
  locked        boolean default false,
  unique (proposal_id, student_id)
);

-- ─── Proposal metrics ─────────────────────────────────────────────────────────
create table proposal_metrics (
  id            uuid primary key default uuid_generate_v4(),
  proposal_id   uuid not null references proposals(id) on delete cascade,
  metric_key    text not null,
  metric_value  numeric(8,4) not null,
  target_class  text,
  created_at    timestamptz default now()
);

-- ─── Sociogram metrics ────────────────────────────────────────────────────────
create table sociogram_metrics (
  id              uuid primary key default uuid_generate_v4(),
  process_id      uuid not null references processes(id) on delete cascade,
  student_id      uuid not null references students(id) on delete cascade,
  received_count  int default 0,
  given_count     int default 0,
  reciprocal_count int default 0,
  centrality      numeric(6,4) default 0,
  betweenness     numeric(6,4) default 0,
  isolation_score numeric(6,4) default 0,
  community_id    int,
  created_at      timestamptz default now(),
  unique (process_id, student_id)
);

-- ─── Audit logs ───────────────────────────────────────────────────────────────
create table audit_logs (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references users(id),
  center_id   uuid not null references centers(id),
  process_id  uuid references processes(id),
  action      text not null,
  entity_type text not null,
  entity_id   uuid,
  created_at  timestamptz default now(),
  metadata    jsonb
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
create index idx_processes_center    on processes(center_id);
create index idx_students_process    on students(process_id);
create index idx_responses_process   on responses(process_id);
create index idx_responses_respondent on responses(respondent_student_id);
create index idx_rules_process       on rules(process_id);
create index idx_proposals_process   on proposals(process_id);
create index idx_assignments_proposal on proposal_assignments(proposal_id);
create index idx_sociogram_process   on sociogram_metrics(process_id);
create index idx_audit_process       on audit_logs(process_id);
create index idx_tokens_token        on questionnaire_tokens(token);

-- ─── Row Level Security ───────────────────────────────────────────────────────
alter table centers                enable row level security;
alter table users                  enable row level security;
alter table processes              enable row level security;
alter table students               enable row level security;
alter table questionnaire_settings enable row level security;
alter table questionnaire_tokens   enable row level security;
alter table responses              enable row level security;
alter table rules                  enable row level security;
alter table rule_students          enable row level security;
alter table proposals              enable row level security;
alter table proposal_assignments   enable row level security;
alter table proposal_metrics       enable row level security;
alter table sociogram_metrics      enable row level security;
alter table audit_logs             enable row level security;

-- Users can read their own center
create policy "users_read_own_center" on centers
  for select using (
    id in (select center_id from users where id = auth.uid())
  );

-- Users can read their own profile
create policy "users_read_own" on users
  for select using (id = auth.uid());

-- Admins of the same center can read all users in that center
create policy "admins_read_center_users" on users
  for select using (
    center_id in (
      select center_id from users
      where id = auth.uid() and role in ('admin','superadmin')
    )
  );

-- Processes: users can read processes of their center
create policy "users_read_center_processes" on processes
  for select using (
    center_id in (select center_id from users where id = auth.uid())
  );

create policy "admins_manage_processes" on processes
  for all using (
    center_id in (
      select center_id from users
      where id = auth.uid() and role in ('admin','superadmin')
    )
  );

-- Students: users in same center can read
create policy "users_read_students" on students
  for select using (
    process_id in (
      select p.id from processes p
      join users u on u.center_id = p.center_id
      where u.id = auth.uid()
    )
  );

create policy "admins_manage_students" on students
  for all using (
    process_id in (
      select p.id from processes p
      join users u on u.center_id = p.center_id
      where u.id = auth.uid() and u.role in ('admin','superadmin','tutor','orientador')
    )
  );

-- Questionnaire tokens: public read by token (for student access)
create policy "public_read_token" on questionnaire_tokens
  for select using (true);

-- Responses: student can insert their own (via token, handled in API)
create policy "admins_read_responses" on responses
  for select using (
    process_id in (
      select p.id from processes p
      join users u on u.center_id = p.center_id
      where u.id = auth.uid() and u.role in ('admin','superadmin','orientador')
    )
  );

-- Rules: admins and tutors can manage
create policy "users_read_rules" on rules
  for select using (
    process_id in (
      select p.id from processes p
      join users u on u.center_id = p.center_id
      where u.id = auth.uid()
    )
  );

create policy "admins_manage_rules" on rules
  for all using (
    process_id in (
      select p.id from processes p
      join users u on u.center_id = p.center_id
      where u.id = auth.uid() and u.role in ('admin','superadmin','tutor','orientador')
    )
  );

-- Proposals: admins read/write
create policy "admins_manage_proposals" on proposals
  for all using (
    process_id in (
      select p.id from processes p
      join users u on u.center_id = p.center_id
      where u.id = auth.uid() and u.role in ('admin','superadmin','tutor','orientador')
    )
  );

-- Sociogram: admins and orientadores can read
create policy "authorized_read_sociogram" on sociogram_metrics
  for select using (
    process_id in (
      select p.id from processes p
      join users u on u.center_id = p.center_id
      where u.id = auth.uid() and u.role in ('admin','superadmin','orientador','tutor')
    )
  );

-- ─── Trigger: updated_at ──────────────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_processes_updated_at
  before update on processes
  for each row execute function set_updated_at();

create trigger trg_users_updated_at
  before update on users
  for each row execute function set_updated_at();

-- ─── Trigger: auto-create user profile ───────────────────────────────────────
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into users (id, email, name, role, center_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'admin'),
    (new.raw_user_meta_data->>'center_id')::uuid
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
