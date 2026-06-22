-- 036 — Notas de intervención por alumno (registro de acciones del equipo)
CREATE TABLE public.intervention_notes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  process_id uuid NOT NULL REFERENCES public.processes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(content) > 0),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_name text,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX ON public.intervention_notes(process_id, student_id);
CREATE INDEX ON public.intervention_notes(student_id);

ALTER TABLE public.intervention_notes ENABLE ROW LEVEL SECURITY;
-- Backend uses service_role which bypasses RLS; anon/authenticated blocked by default
