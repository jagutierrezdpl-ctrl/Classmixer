-- 039 — Intervention Workflow: casos de seguimiento con estados Kanban
-- Cada alumno que genera una alerta CDC puede tener un caso activo por proceso.
-- Las acciones registran todas las intervenciones realizadas.

CREATE TABLE public.intervention_cases (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  process_id uuid NOT NULL REFERENCES public.processes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'detectado'
    CHECK (status IN ('detectado', 'en_revision', 'intervencion_activa', 'resuelto', 'derivado')),
  priority text NOT NULL DEFAULT 'media'
    CHECK (priority IN ('urgente', 'alta', 'media', 'baja')),
  reason text NOT NULL DEFAULT 'manual',
  -- reason values: bullying_risk | cdc_rechazado | aislamiento | vulnerable | manual
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_to_name text,
  due_date date,
  resolved_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_name text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(process_id, student_id)
);

CREATE TABLE public.intervention_actions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id uuid NOT NULL REFERENCES public.intervention_cases(id) ON DELETE CASCADE,
  action_type text NOT NULL DEFAULT 'nota'
    CHECK (action_type IN ('nota', 'reunion_tutor', 'reunion_padres', 'reunion_orientador', 'comunicado', 'derivacion', 'seguimiento')),
  description text NOT NULL CHECK (char_length(description) > 0),
  completed_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_name text,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX ON public.intervention_cases(process_id, status);
CREATE INDEX ON public.intervention_cases(student_id);
CREATE INDEX ON public.intervention_cases(assigned_to);
CREATE INDEX ON public.intervention_actions(case_id, created_at DESC);

ALTER TABLE public.intervention_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intervention_actions ENABLE ROW LEVEL SECURITY;
-- service_role bypasses RLS for all backend writes

-- Add metadata column to ai_reports for per-student report tracking
ALTER TABLE public.ai_reports ADD COLUMN IF NOT EXISTS metadata jsonb;
CREATE INDEX IF NOT EXISTS idx_ai_reports_metadata_student ON public.ai_reports USING gin(metadata) WHERE metadata IS NOT NULL;
