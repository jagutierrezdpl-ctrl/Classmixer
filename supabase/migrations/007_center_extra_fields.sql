-- Extra fields for centers (registration form)
ALTER TABLE centers
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS web   text,
  ADD COLUMN IF NOT EXISTS type  text CHECK (type IN ('publico', 'concertado', 'privado'));
