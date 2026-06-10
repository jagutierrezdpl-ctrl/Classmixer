-- ─── Proposal class tutors ────────────────────────────────────────────────────
-- Stores which teacher is assigned to each target class in a proposal

create table if not exists proposal_class_tutors (
  id          uuid default gen_random_uuid() primary key,
  proposal_id uuid references proposals(id) on delete cascade not null,
  target_class text not null,
  user_id     uuid references users(id) on delete cascade not null,
  created_at  timestamptz default now(),
  unique(proposal_id, target_class)
);

-- ─── Rules: add metadata column for tutor rules ───────────────────────────────
-- avoid_tutor rule uses metadata->>'tutor_id' to store the user uuid

alter table rules
  add column if not exists metadata jsonb default '{}';

-- New rule type added: avoid_tutor
-- rule_type check constraint needs updating if it exists
-- (safe to skip if no check constraint — Supabase doesn't add one by default)
