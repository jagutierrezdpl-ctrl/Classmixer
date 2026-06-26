-- Sociogram snapshots: point-in-time copies of sociometric response data
-- Allows selecting which questionnaire round's data to use for cooperative groups

CREATE TABLE IF NOT EXISTS sociogram_snapshots (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id  uuid NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  -- Compact copy of response connections at snapshot time
  -- [{from: student_id, to: student_id, type: "friendship"|"work"|"negative"|...}]
  connections jsonb NOT NULL DEFAULT '[]',
  response_count integer,
  created_by  uuid REFERENCES users(id),
  created_at  timestamptz DEFAULT now()
);

-- Add snapshot reference to group_sessions
ALTER TABLE group_sessions
  ADD COLUMN IF NOT EXISTS sociogram_snapshot_id uuid REFERENCES sociogram_snapshots(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS sociogram_snapshots_process_idx ON sociogram_snapshots(process_id);
CREATE INDEX IF NOT EXISTS group_sessions_snapshot_idx ON group_sessions(sociogram_snapshot_id);

-- RLS
ALTER TABLE sociogram_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "center_members_read_sociogram_snapshots" ON sociogram_snapshots
  FOR SELECT USING (
    process_id IN (
      SELECT p.id FROM processes p
      JOIN users u ON u.center_id = p.center_id
      WHERE u.id = auth.uid()
    )
  );

CREATE POLICY "center_members_manage_sociogram_snapshots" ON sociogram_snapshots
  FOR ALL USING (
    process_id IN (
      SELECT p.id FROM processes p
      JOIN users u ON u.center_id = p.center_id
      WHERE u.id = auth.uid()
    )
  );
