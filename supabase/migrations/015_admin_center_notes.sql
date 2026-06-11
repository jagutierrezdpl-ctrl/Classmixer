-- Migration 015: Internal notes per center for superadmin (incidents/support log)

CREATE TABLE IF NOT EXISTS admin_center_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id   uuid NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  author_id   uuid NOT NULL,
  author_name text NOT NULL,
  content     text NOT NULL,
  note_type   text NOT NULL DEFAULT 'nota'
                CHECK (note_type IN ('nota', 'incidencia', 'resuelto', 'aviso')),
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_center_notes_center ON admin_center_notes (center_id);
CREATE INDEX IF NOT EXISTS idx_admin_center_notes_created ON admin_center_notes (created_at DESC);
