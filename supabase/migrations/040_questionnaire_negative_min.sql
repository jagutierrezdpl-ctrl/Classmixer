-- Add negative_min to questionnaire_settings so admins can configure
-- a minimum number of selections for the convivencia question.
-- Defaults to 0 (optional) to preserve existing behavior.
ALTER TABLE questionnaire_settings
  ADD COLUMN IF NOT EXISTS negative_min int NOT NULL DEFAULT 0;
