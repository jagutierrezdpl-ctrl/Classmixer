-- Migration 014: Add avoid_tutor to rules.rule_type CHECK constraint

ALTER TABLE rules DROP CONSTRAINT IF EXISTS rules_rule_type_check;

ALTER TABLE rules
  ADD CONSTRAINT rules_rule_type_check
  CHECK (rule_type IN (
    'must_separate',
    'should_keep_together',
    'must_keep_together',
    'keep_at_least_one',
    'max_from_group',
    'lock_student_to_class',
    'exclude_student',
    'protect_vulnerable',
    'avoid_tutor'
  ));
