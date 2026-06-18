-- ─────────────────────────────────────────────────────────────────────────────
-- 033 — Security fixes
--
-- A. Storage RLS: restrict center-logos bucket so users can only upload/delete
--    files inside their own center_id folder (cross-tenant bypass fix).
--
-- B. Column-level privilege: prevent authenticated/anon roles from reading
--    openrouter_api_key directly via REST API (exposure fix).
--    All API routes use createServiceClient() (service_role) which is not
--    affected by column-level revokes.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── A. Fix cross-tenant Storage RLS ─────────────────────────────────────────

DROP POLICY IF EXISTS "center_logo_upload" ON storage.objects;
DROP POLICY IF EXISTS "center_logo_delete" ON storage.objects;

-- Only allow upload inside /{center_id}/ — must match the uploading user's center
CREATE POLICY "center_logo_upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'center-logos'
  AND (storage.foldername(name))[1] = (
    SELECT center_id::text FROM public.users WHERE id = auth.uid()
  )
);

-- Only allow delete of files inside /{center_id}/ — must match the user's center
CREATE POLICY "center_logo_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'center-logos'
  AND (storage.foldername(name))[1] = (
    SELECT center_id::text FROM public.users WHERE id = auth.uid()
  )
);

-- ─── B. Prevent direct REST access to openrouter_api_key ─────────────────────
-- The column stays in the centers table (no code changes needed).
-- Service role (used by all Next.js API routes) bypasses column-level revokes.
-- Authenticated and anon roles can no longer SELECT this column directly.

REVOKE SELECT (openrouter_api_key) ON public.centers FROM authenticated, anon;
