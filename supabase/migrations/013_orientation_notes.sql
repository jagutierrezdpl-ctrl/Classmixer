-- Migration 013: Orientation notes (private per-student notes for orientador/admin)

CREATE TABLE IF NOT EXISTS orientation_notes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_profile_id  uuid NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
  center_id           uuid NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  author_id           uuid NOT NULL,
  author_name         text NOT NULL,
  content             text NOT NULL,
  created_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orientation_notes_student
  ON orientation_notes (student_profile_id);

CREATE INDEX IF NOT EXISTS idx_orientation_notes_center
  ON orientation_notes (center_id);

-- RLS
ALTER TABLE orientation_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orientation_notes_select" ON orientation_notes FOR SELECT USING (
  center_id = current_center_id() AND is_admin_or_superadmin()
);

CREATE POLICY "orientation_notes_insert" ON orientation_notes FOR INSERT WITH CHECK (
  center_id = current_center_id() AND is_admin_or_superadmin()
);

CREATE POLICY "orientation_notes_delete" ON orientation_notes FOR DELETE USING (
  center_id = current_center_id() AND is_admin_or_superadmin()
);
