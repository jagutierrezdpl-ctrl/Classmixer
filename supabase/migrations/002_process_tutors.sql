-- ─── Process tutors (tutor → process assignment) ─────────────────────────────
create table if not exists process_tutors (
  id          uuid primary key default uuid_generate_v4(),
  process_id  uuid not null references processes(id) on delete cascade,
  user_id     uuid not null references users(id) on delete cascade,
  assigned_by uuid references users(id),
  created_at  timestamptz default now(),
  unique (process_id, user_id)
);

create index if not exists process_tutors_process_id_idx on process_tutors (process_id);
create index if not exists process_tutors_user_id_idx    on process_tutors (user_id);
