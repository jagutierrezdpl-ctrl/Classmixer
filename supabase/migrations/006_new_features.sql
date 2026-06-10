-- ─── 1. Process type (mezcla / sociograma) ───────────────────────────────────
ALTER TABLE processes
  ADD COLUMN IF NOT EXISTS process_type TEXT NOT NULL DEFAULT 'mezcla'
    CHECK (process_type IN ('mezcla', 'sociograma'));

-- ─── 2. Ordered selection in responses ───────────────────────────────────────
-- selection_order: 1 = first choice (highest priority), 2 = second, etc.
ALTER TABLE responses
  ADD COLUMN IF NOT EXISTS selection_order INT;

-- ─── 3. Auto-close questionnaire setting ──────────────────────────────────────
ALTER TABLE questionnaire_settings
  ADD COLUMN IF NOT EXISTS auto_close_questionnaire BOOLEAN NOT NULL DEFAULT FALSE;

-- ─── 4. Student profiles (persistent per center) ─────────────────────────────
-- Global student identity that persists across processes/school years
CREATE TABLE IF NOT EXISTS student_profiles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id     UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  external_id   TEXT NOT NULL,
  first_name    TEXT NOT NULL,
  last_name     TEXT NOT NULL,
  birth_year    INT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(center_id, external_id)
);

-- ─── 5. Link students to profiles ────────────────────────────────────────────
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS student_profile_id UUID REFERENCES student_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_students_profile_id ON students(student_profile_id);
CREATE INDEX IF NOT EXISTS idx_student_profiles_center ON student_profiles(center_id);

-- ─── 6. RLS for student_profiles ────────────────────────────────────────────
ALTER TABLE student_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student_profiles_select" ON student_profiles FOR SELECT USING (
  center_id = current_center_id() OR is_superadmin()
);
CREATE POLICY "student_profiles_insert" ON student_profiles FOR INSERT WITH CHECK (
  (center_id = current_center_id() AND is_admin_or_superadmin()) OR is_superadmin()
);
CREATE POLICY "student_profiles_update" ON student_profiles FOR UPDATE USING (
  (center_id = current_center_id() AND is_admin_or_superadmin()) OR is_superadmin()
);
CREATE POLICY "student_profiles_delete" ON student_profiles FOR DELETE USING (
  (center_id = current_center_id() AND is_admin_or_superadmin()) OR is_superadmin()
);
