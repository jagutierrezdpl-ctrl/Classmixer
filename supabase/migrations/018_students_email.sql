-- Migration 018: Add email column to students table
-- Enables reliable linking to student_profiles via email instead of name matching

ALTER TABLE students ADD COLUMN IF NOT EXISTS email text;

CREATE INDEX IF NOT EXISTS idx_students_email ON students(email) WHERE email IS NOT NULL;
