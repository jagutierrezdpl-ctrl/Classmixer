-- ─────────────────────────────────────────────────────────────────────────────
-- 034 — New features: annotations, in-app notifications, followup processes
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── A. Sociogram annotations (orientador layer on graph nodes) ───────────────
CREATE TABLE IF NOT EXISTS sociogram_annotations (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  process_id   uuid NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
  student_id   uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  author_id    uuid NOT NULL REFERENCES users(id),
  note         text NOT NULL DEFAULT '',
  status       text NOT NULL DEFAULT 'sin_accion'
               CHECK (status IN ('sin_accion', 'revisado', 'en_seguimiento', 'intervencion_activa')),
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS sociogram_annotations_unique
  ON sociogram_annotations (process_id, student_id);

-- ─── B. In-app notifications ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_notifications (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  center_id    uuid NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  user_id      uuid REFERENCES users(id) ON DELETE CASCADE,   -- null = all admins of center
  type         text NOT NULL,   -- questionnaire_complete | bullying_risk | proposal_generated | rule_conflict
  title        text NOT NULL,
  message      text NOT NULL,
  entity_type  text,            -- process | student | proposal
  entity_id    uuid,
  process_id   uuid REFERENCES processes(id) ON DELETE CASCADE,
  read         boolean NOT NULL DEFAULT false,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_notifications_center_idx ON app_notifications (center_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS app_notifications_user_idx   ON app_notifications (user_id, read);

-- ─── C. Follow-up processes (post-mix tracking) ───────────────────────────────
ALTER TABLE processes ADD COLUMN IF NOT EXISTS parent_process_id uuid REFERENCES processes(id) ON DELETE SET NULL;
ALTER TABLE processes ADD COLUMN IF NOT EXISTS process_type text NOT NULL DEFAULT 'mixing'
  CHECK (process_type IN ('mixing', 'followup'));
