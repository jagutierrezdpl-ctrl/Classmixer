-- Migration 006: email en student_profiles para login Google de alumnos
-- Ejecutar en Supabase Dashboard → SQL Editor

ALTER TABLE student_profiles
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS google_id text;

-- Email único por centro (un alumno puede estar en máximo un centro activo)
CREATE UNIQUE INDEX IF NOT EXISTS student_profiles_email_unique
  ON student_profiles (email)
  WHERE email IS NOT NULL;

-- Índice para búsqueda rápida por email
CREATE INDEX IF NOT EXISTS student_profiles_email_idx
  ON student_profiles (email);
