-- Center groups registry: allows creating groups before students are imported
CREATE TABLE IF NOT EXISTS center_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id uuid NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  name text NOT NULL,
  school_year text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  UNIQUE(center_id, name)
);
