-- ─────────────────────────────────────────────────────────────────────────────
-- 038 — Granular RLS SELECT policies for newer tables
-- ─────────────────────────────────────────────────────────────────────────────
-- The backend uses service_role (bypasses RLS for all writes/reads), so these
-- policies only control direct authenticated-role access (e.g. Supabase client
-- in-browser or Supabase Studio queries running as the logged-in user).
-- Each policy gates SELECT to rows belonging to the user's own center.
-- All policies are idempotent via DROP … IF EXISTS before CREATE.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── ai_reports ──────────────────────────────────────────────────────────────
-- Users can only read AI reports generated for processes in their center.

DROP POLICY IF EXISTS "ai_reports_select" ON public.ai_reports;

CREATE POLICY "ai_reports_select" ON public.ai_reports FOR SELECT
  USING (
    process_id IN (
      SELECT id FROM public.processes WHERE center_id = (
        SELECT center_id FROM public.users WHERE id = auth.uid()
      )
    )
  );


-- ── intervention_notes ───────────────────────────────────────────────────────
-- Users can only read intervention notes that belong to their center's processes.

DROP POLICY IF EXISTS "intervention_notes_select" ON public.intervention_notes;

CREATE POLICY "intervention_notes_select" ON public.intervention_notes FOR SELECT
  USING (
    process_id IN (
      SELECT id FROM public.processes WHERE center_id = (
        SELECT center_id FROM public.users WHERE id = auth.uid()
      )
    )
  );


-- ── sociogram_annotations ────────────────────────────────────────────────────
-- Table may or may not exist depending on migration order; guard with a DO block.
-- Users can only read annotations for their center's processes.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'sociogram_annotations'
  ) THEN
    DROP POLICY IF EXISTS "sociogram_annotations_select" ON public.sociogram_annotations;

    CREATE POLICY "sociogram_annotations_select" ON public.sociogram_annotations FOR SELECT
      USING (
        process_id IN (
          SELECT id FROM public.processes WHERE center_id = (
            SELECT center_id FROM public.users WHERE id = auth.uid()
          )
        )
      );
  END IF;
END;
$$;


-- ── app_notifications ────────────────────────────────────────────────────────
-- Users can only read notifications addressed to their own center.

DROP POLICY IF EXISTS "app_notifications_select" ON public.app_notifications;

CREATE POLICY "app_notifications_select" ON public.app_notifications FOR SELECT
  USING (
    center_id = (SELECT center_id FROM public.users WHERE id = auth.uid())
  );


-- ── questionnaire_questions ──────────────────────────────────────────────────
-- Users can only read questionnaire questions for their center's processes.

DROP POLICY IF EXISTS "questionnaire_questions_select" ON public.questionnaire_questions;

CREATE POLICY "questionnaire_questions_select" ON public.questionnaire_questions FOR SELECT
  USING (
    process_id IN (
      SELECT id FROM public.processes WHERE center_id = (
        SELECT center_id FROM public.users WHERE id = auth.uid()
      )
    )
  );


-- ── climate_responses ────────────────────────────────────────────────────────
-- Users can only read climate responses for their center's processes.

DROP POLICY IF EXISTS "climate_responses_select" ON public.climate_responses;

CREATE POLICY "climate_responses_select" ON public.climate_responses FOR SELECT
  USING (
    process_id IN (
      SELECT id FROM public.processes WHERE center_id = (
        SELECT center_id FROM public.users WHERE id = auth.uid()
      )
    )
  );
