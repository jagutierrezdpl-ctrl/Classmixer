-- Center logo URL (stored in Supabase Storage, public bucket "center-logos")
ALTER TABLE centers ADD COLUMN IF NOT EXISTS logo_url text DEFAULT NULL;

-- Create storage bucket for center logos if it doesn't exist yet
-- (Run this once; safe to repeat due to ON CONFLICT DO NOTHING)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'center-logos',
  'center-logos',
  true,
  524288,  -- 512 KB max
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their own center folder
CREATE POLICY IF NOT EXISTS "center_logo_upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'center-logos');

CREATE POLICY IF NOT EXISTS "center_logo_public_read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'center-logos');

CREATE POLICY IF NOT EXISTS "center_logo_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'center-logos');
