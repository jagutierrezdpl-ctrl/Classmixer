-- Índices para acelerar la consulta de plantillas por centro y sus preguntas asociadas
-- (usadas en GET /api/questionnaire/templates y POST .../apply-template).
create index if not exists idx_questionnaire_templates_center
  on questionnaire_templates(center_id);

create index if not exists idx_questionnaire_template_questions_template
  on questionnaire_template_questions(template_id);
