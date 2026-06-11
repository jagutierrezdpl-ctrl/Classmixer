-- Migration 016: Add average_grade column to student_profiles

ALTER TABLE student_profiles
  ADD COLUMN IF NOT EXISTS average_grade numeric(4,2)
    CHECK (average_grade >= 0 AND average_grade <= 10);
