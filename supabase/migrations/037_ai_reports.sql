-- 037 — Informes IA persistentes por proceso
CREATE TABLE public.ai_reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  process_id uuid NOT NULL REFERENCES public.processes(id) ON DELETE CASCADE,
  report_type text NOT NULL DEFAULT 'sociogram'
    CHECK (report_type IN ('sociogram', 'convivencia', 'proposal', 'student')),
  content text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_name text,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX ON public.ai_reports(process_id, report_type, created_at DESC);

ALTER TABLE public.ai_reports ENABLE ROW LEVEL SECURITY;
-- Backend uses service_role which bypasses RLS
