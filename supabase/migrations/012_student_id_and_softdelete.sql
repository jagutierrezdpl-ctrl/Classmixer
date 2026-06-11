-- Migration 012: Auto-increment student IDs + soft delete

-- 1. Add active column to student_profiles (soft delete)
ALTER TABLE student_profiles
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

-- 2. Add student counter per center
ALTER TABLE centers
  ADD COLUMN IF NOT EXISTS student_counter integer NOT NULL DEFAULT 0;

-- 3. Initialize counter from existing students (use MAX external_id as seed)
UPDATE centers c
SET student_counter = COALESCE((
  SELECT MAX(CAST(sp.external_id AS integer))
  FROM student_profiles sp
  WHERE sp.center_id = c.id
    AND sp.external_id ~ '^[0-9]+$'
), 0);

-- 4. Trigger function: assign sequential external_id on INSERT if NULL
CREATE OR REPLACE FUNCTION assign_student_external_id()
RETURNS TRIGGER AS $$
DECLARE
  new_counter integer;
BEGIN
  IF NEW.external_id IS NULL OR NEW.external_id = '' THEN
    UPDATE centers
    SET student_counter = student_counter + 1
    WHERE id = NEW.center_id
    RETURNING student_counter INTO new_counter;

    NEW.external_id := LPAD(new_counter::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Attach trigger (BEFORE INSERT so it sets external_id before constraint check)
DROP TRIGGER IF EXISTS student_auto_id_trigger ON student_profiles;
CREATE TRIGGER student_auto_id_trigger
  BEFORE INSERT ON student_profiles
  FOR EACH ROW
  EXECUTE FUNCTION assign_student_external_id();

-- 6. Index for fast active-only queries
CREATE INDEX IF NOT EXISTS idx_student_profiles_active
  ON student_profiles (center_id, active);
