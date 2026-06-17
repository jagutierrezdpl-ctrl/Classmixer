-- Add configurable AI model selection per center
ALTER TABLE centers ADD COLUMN IF NOT EXISTS openrouter_model text DEFAULT NULL;
