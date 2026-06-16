-- Per-center OpenRouter API key for AI-generated explanations (sociogram/proposals).
-- When set, takes priority over the platform-wide ANTHROPIC_API_KEY env var.
-- Only readable/writable via the service role through /api/settings/center (admin/superadmin).
ALTER TABLE centers
  ADD COLUMN IF NOT EXISTS openrouter_api_key text;
