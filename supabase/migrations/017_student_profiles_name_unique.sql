-- Migration 017: Unique index on student_profiles (center_id, first_name, last_name)
-- Required for the name-based upsert in /api/student-profiles/import

-- Remove duplicate rows first (keep the one with the highest id to preserve external_id)
DELETE FROM student_profiles sp1
WHERE sp1.id NOT IN (
  SELECT DISTINCT ON (center_id, first_name, last_name) id
  FROM student_profiles
  ORDER BY center_id, first_name, last_name, id DESC
);

CREATE UNIQUE INDEX IF NOT EXISTS student_profiles_name_unique
  ON student_profiles (center_id, first_name, last_name);
