-- ─── Acceso del profesorado al alumnado de los grupos que imparte ─────────────
-- Un profesor solo ve las fichas de los alumnos de los grupos en los que EduPlataforma
-- (teacher_subjects del curso activo) dice que da clase. Es una copia de solo lectura que
-- rellena la sincronización con el hub; a diferencia de group_tutors (un tutor por grupo),
-- admite varios profesores por grupo y varios grupos por profesor.
--
-- Solo la escribe/lee el servidor con la service role (que se salta RLS). Se activa RLS sin
-- políticas para que ningún cliente con sesión de usuario pueda leerla ni modificarla.

CREATE TABLE IF NOT EXISTS teacher_group_access (
  center_id    uuid        NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  group_name   text        NOT NULL,
  school_year  text        NOT NULL,
  synced_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (center_id, user_id, group_name, school_year)
);

CREATE INDEX IF NOT EXISTS teacher_group_access_user_idx
  ON teacher_group_access (center_id, user_id);

ALTER TABLE teacher_group_access ENABLE ROW LEVEL SECURITY;
