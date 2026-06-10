-- Enhance student_profiles with full personal/academic data
ALTER TABLE student_profiles
  ADD COLUMN IF NOT EXISTS gender          text,
  ADD COLUMN IF NOT EXISTS current_class   text,
  ADD COLUMN IF NOT EXISTS birth_year      int,
  ADD COLUMN IF NOT EXISTS academic_level  text,
  ADD COLUMN IF NOT EXISTS behavior_level  text,
  ADD COLUMN IF NOT EXISTS needs_type      text,
  ADD COLUMN IF NOT EXISTS observations    text,
  ADD COLUMN IF NOT EXISTS school_year     text,
  ADD COLUMN IF NOT EXISTS updated_at      timestamptz DEFAULT now();

-- Group-tutor assignments (tutor → class group at center level)
CREATE TABLE IF NOT EXISTS group_tutors (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  center_id    uuid NOT NULL REFERENCES centers(id)  ON DELETE CASCADE,
  group_name   text NOT NULL,
  school_year  text NOT NULL,
  user_id      uuid NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  created_at   timestamptz DEFAULT now(),
  UNIQUE (center_id, group_name, school_year)
);

CREATE INDEX IF NOT EXISTS group_tutors_center_idx ON group_tutors (center_id);
CREATE INDEX IF NOT EXISTS group_tutors_user_idx   ON group_tutors (user_id);

ALTER TABLE group_tutors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "group_tutors_select" ON group_tutors FOR SELECT
  USING (center_id = current_center_id() OR is_superadmin());

CREATE POLICY "group_tutors_insert" ON group_tutors FOR INSERT
  WITH CHECK ((center_id = current_center_id() AND is_admin_or_superadmin()) OR is_superadmin());

CREATE POLICY "group_tutors_update" ON group_tutors FOR UPDATE
  USING ((center_id = current_center_id() AND is_admin_or_superadmin()) OR is_superadmin());

CREATE POLICY "group_tutors_delete" ON group_tutors FOR DELETE
  USING ((center_id = current_center_id() AND is_admin_or_superadmin()) OR is_superadmin());
