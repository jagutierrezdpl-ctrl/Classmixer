-- Add active column to users table for deactivating without deleting
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
