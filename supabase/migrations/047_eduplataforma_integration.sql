-- ─── Integración con EduPlataforma (hub) ──────────────────────────────────────
-- Permite que un centro de ClassMixer quede vinculado/aprovisionado desde
-- EduPlataforma (SSO + pull de personal/alumnado/grupos), igual que EduPulso.

ALTER TABLE centers
  ADD COLUMN IF NOT EXISTS eduplataforma_center_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS last_synced_at          timestamptz;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS eduplataforma_user_id text;

ALTER TABLE center_groups
  ADD COLUMN IF NOT EXISTS eduplataforma_group_id text;

-- Permite upsert por (center_id, eduplataforma_group_id). Varios NULL conviven sin
-- conflicto (grupos locales no vinculados a EduPlataforma), como es habitual en Postgres.
ALTER TABLE center_groups
  ADD CONSTRAINT center_groups_eduplataforma_group_unique
  UNIQUE (center_id, eduplataforma_group_id);

CREATE INDEX IF NOT EXISTS idx_centers_eduplataforma_id
  ON centers (eduplataforma_center_id);
