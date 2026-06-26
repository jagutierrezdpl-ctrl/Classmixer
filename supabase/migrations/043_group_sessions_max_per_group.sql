-- Allow configuring maximum students per group in cooperative group sessions
ALTER TABLE group_sessions
  ADD COLUMN IF NOT EXISTS max_per_group integer;
