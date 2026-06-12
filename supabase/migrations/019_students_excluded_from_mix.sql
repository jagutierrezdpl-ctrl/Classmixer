-- Mark a student as excluded from mix generation and sociogram calculations
-- without deleting them or their responses (reversible)
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS excluded_from_mix boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS excluded_reason text;
