-- Documents uploaded by admins to provide context for AI analysis.
-- Content is stored as markdown (converted from PDF via markitdown).

CREATE TABLE process_documents (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id  uuid        NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
  center_id   uuid        NOT NULL REFERENCES centers(id)  ON DELETE CASCADE,
  name        text        NOT NULL,
  original_filename text  NOT NULL,
  content_markdown  text  NOT NULL,
  created_by  uuid        REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE process_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Center members can view documents"
  ON process_documents FOR SELECT
  USING (
    center_id = (SELECT center_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Admins and orientadores can manage documents"
  ON process_documents FOR ALL
  USING (
    center_id = (SELECT center_id FROM users WHERE id = auth.uid())
    AND (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'superadmin', 'orientador')
  );

CREATE INDEX process_documents_process_id_idx ON process_documents(process_id);
