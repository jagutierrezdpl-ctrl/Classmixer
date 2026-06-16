-- ─── Question type catalog ────────────────────────────────────────────────────
-- Catálogo configurable de tipos de pregunta sociométrica. Los 4 tipos legacy
-- (friendship/work/emotional/negative) se siembran con el mismo comportamiento
-- que ya tenían en questionnaire_settings/responses — esto no cambia nada para
-- los procesos existentes, solo añade un catálogo que el motor podrá leer.
--
-- Todo el archivo es idempotente (if not exists / on conflict / where not exists)
-- para poder re-ejecutarlo sin riesgo si una corrida anterior falló a mitad.
create table if not exists question_types (
  id              uuid primary key default uuid_generate_v4(),
  code            text not null unique,
  category        text not null
                    check (category in ('peer_choice','peer_scale','role_nomination','climate','bullying')),
  label           text not null,
  description     text,
  icon            text,
  color           text,
  default_min     int not null default 0,
  default_max     int not null default 5,
  sensitivity     text not null default 'normal'
                    check (sensitivity in ('normal','sensitive','very_sensitive')),
  scoring_role    text not null default 'none'
                    check (scoring_role in ('none','friendship_like','work_like','negative_like')),
  input_mode      text not null default 'choice'
                    check (input_mode in ('choice','scale','climate')),
  is_system       boolean not null default true,
  center_id       uuid references centers(id) on delete cascade,
  active          boolean not null default true,
  created_at      timestamptz default now()
);

-- ─── Preguntas avanzadas activadas por proceso ────────────────────────────────
-- Capa adicional sobre questionnaire_settings (que sigue intacta para los 4
-- tipos legacy). Aquí solo viven las preguntas nuevas que un centro activa.
create table if not exists questionnaire_questions (
  id                    uuid primary key default uuid_generate_v4(),
  process_id            uuid not null references processes(id) on delete cascade,
  question_type_id      uuid not null references question_types(id) on delete cascade,
  enabled               boolean not null default true,
  min                   int,
  max                   int,
  sort_order            int not null default 0,
  label_override        text,
  description_override  text,
  created_at            timestamptz default now(),
  unique (process_id, question_type_id)
);

-- ─── Respuestas de clima de aula ───────────────────────────────────────────────
-- No están dirigidas a un compañero concreto (a diferencia de `responses`),
-- por eso viven en su propia tabla en vez de forzar target_student_id a nullable.
create table if not exists climate_responses (
  id                      uuid primary key default uuid_generate_v4(),
  process_id              uuid not null references processes(id) on delete cascade,
  respondent_student_id   uuid not null references students(id) on delete cascade,
  question_type_id        uuid not null references question_types(id) on delete cascade,
  value                   int not null check (value between 1 and 5),
  created_at              timestamptz default now(),
  unique (process_id, respondent_student_id, question_type_id)
);

-- ─── Plantillas de cuestionario ────────────────────────────────────────────────
create table if not exists questionnaire_templates (
  id          uuid primary key default uuid_generate_v4(),
  center_id   uuid references centers(id) on delete cascade,
  name        text not null,
  description text,
  is_system   boolean not null default false,
  created_at  timestamptz default now()
);

create table if not exists questionnaire_template_questions (
  id                uuid primary key default uuid_generate_v4(),
  template_id       uuid not null references questionnaire_templates(id) on delete cascade,
  question_type_id  uuid not null references question_types(id) on delete cascade,
  default_enabled   boolean not null default true,
  default_min       int,
  default_max       int,
  sort_order        int not null default 0,
  unique (template_id, question_type_id)
);

-- ─── Responses: metadata para preguntas con contexto adicional ───────────────
-- (ej. módulo de convivencia: frecuencia/lugar). Nullable, no afecta filas existentes.
alter table responses add column if not exists metadata jsonb;

-- El CHECK fijo de 4 valores deja paso a la validación dinámica contra
-- question_types.code en la capa de aplicación (ya es ahí donde ocurre
-- la validación real hoy, en /api/q/[token]).
alter table responses drop constraint if exists responses_relation_type_check;

-- ─── Indexes ──────────────────────────────────────────────────────────────────
create index if not exists idx_questionnaire_questions_process on questionnaire_questions(process_id);
create index if not exists idx_climate_responses_process       on climate_responses(process_id);
create index if not exists idx_question_types_center           on question_types(center_id);

-- ─── Row Level Security ───────────────────────────────────────────────────────
alter table question_types                  enable row level security;
alter table questionnaire_questions          enable row level security;
alter table climate_responses                enable row level security;
alter table questionnaire_templates          enable row level security;
alter table questionnaire_template_questions enable row level security;

-- ─── Seed: catálogo de tipos legacy (mismo comportamiento que hoy) ───────────
insert into question_types (code, category, label, description, icon, color, default_min, default_max, sensitivity, scoring_role, input_mode, is_system) values
  ('friendship', 'peer_choice', 'Amistad', 'Elige hasta N compañeros con los que te gustaría compartir clase.', 'Heart', '#ec4899', 1, 5, 'normal', 'friendship_like', 'choice', true),
  ('work',       'peer_choice', 'Trabajo', 'Elige hasta N compañeros con los que trabajas bien en clase.', 'Briefcase', '#3b82f6', 0, 3, 'normal', 'work_like', 'choice', true),
  ('emotional',  'peer_choice', 'Apoyo emocional', 'Elige hasta N compañeros con los que te sientes cómodo o tranquilo.', 'UsersRound', '#8b5cf6', 0, 3, 'sensitive', 'none', 'choice', true),
  ('negative',   'peer_choice', 'Dificultad', '¿Hay algún compañero con quien crees que te cuesta trabajar en clase?', 'XCircle', '#ef4444', 0, 2, 'sensitive', 'negative_like', 'choice', true)
on conflict (code) do nothing;

-- ─── Seed: catálogo de tipos nuevos (disponibles para activar, Fase 3) ───────
insert into question_types (code, category, label, description, icon, color, default_min, default_max, sensitivity, scoring_role, input_mode, is_system) values
  ('role_leader',       'role_nomination', 'Liderazgo',        '¿Quién suele liderar o tomar la iniciativa en el grupo?', 'Crown',       '#f59e0b', 0, 3, 'normal', 'none', 'choice', true),
  ('role_helper',       'role_nomination', 'Ayuda',            '¿Quién suele ayudar cuando alguien lo necesita?',         'HelpingHand', '#10b981', 0, 3, 'normal', 'none', 'choice', true),
  ('role_humor',        'role_nomination', 'Humor',            '¿Quién hace reír o anima al grupo?',                      'Smile',       '#eab308', 0, 3, 'normal', 'none', 'choice', true),
  ('role_disruptor',    'role_nomination', 'Alborotador',      '¿Quién suele interrumpir o desordenar la clase?',         'AlertTriangle','#f97316', 0, 3, 'sensitive', 'none', 'choice', true),
  ('perceived_choice',  'peer_choice',     'Autopercepción',  '¿Quién crees que te elegiría a ti como amigo o amiga?',   'Eye',         '#6366f1', 0, 5, 'normal', 'none', 'choice', true),
  ('climate_safety',    'climate',         'Seguridad en el aula', 'Me siento seguro/a en mi clase.',                     'Shield',      '#0ea5e9', 1, 5, 'normal', 'none', 'climate', true),
  ('climate_belonging', 'climate',         'Pertenencia al grupo', 'Siento que formo parte de mi clase.',                 'Users',       '#0ea5e9', 1, 5, 'normal', 'none', 'climate', true),
  ('bullying_aggressor','bullying',        'Convivencia: quién molesta', '¿Hay algún compañero que moleste o intimide a otros con frecuencia?', 'ShieldAlert', '#dc2626', 0, 3, 'very_sensitive', 'none', 'choice', true),
  ('bullying_victim',   'bullying',        'Convivencia: a quién molestan', '¿Hay algún compañero al que otros suelan molestar o excluir?',       'ShieldAlert', '#dc2626', 0, 3, 'very_sensitive', 'none', 'choice', true),
  ('bullying_witness',  'bullying',        'Convivencia: testigos', '¿Has visto que algún compañero moleste a otro sin formar parte de ello?',    'Eye',         '#dc2626', 0, 3, 'very_sensitive', 'none', 'choice', true)
on conflict (code) do nothing;

-- ─── Seed: plantillas de sistema ──────────────────────────────────────────────
insert into questionnaire_templates (name, description, is_system)
select v.name, v.description, v.is_system
from (values
  ('Simple', 'Amistad y trabajo — el cuestionario por defecto, igual que hasta ahora.', true),
  ('Convivencia', 'Añade roles sociales, clima de aula y el módulo de convivencia/acoso.', true),
  ('Completo', 'Activa todas las preguntas disponibles en el catálogo.', true)
) as v(name, description, is_system)
where not exists (
  select 1 from questionnaire_templates t where t.name = v.name and t.center_id is null
);

insert into questionnaire_template_questions (template_id, question_type_id, default_enabled, default_min, default_max, sort_order)
select t.id, qt.id, true, qt.default_min, qt.default_max, row_number() over (order by qt.code)
from questionnaire_templates t
join question_types qt on qt.code in ('friendship','work')
where t.name = 'Simple' and t.center_id is null
on conflict (template_id, question_type_id) do nothing;

insert into questionnaire_template_questions (template_id, question_type_id, default_enabled, default_min, default_max, sort_order)
select t.id, qt.id, true, qt.default_min, qt.default_max, row_number() over (order by qt.code)
from questionnaire_templates t
join question_types qt on qt.code in (
  'friendship','work','role_leader','role_helper','role_humor','role_disruptor',
  'climate_safety','climate_belonging','bullying_aggressor','bullying_victim','bullying_witness'
)
where t.name = 'Convivencia' and t.center_id is null
on conflict (template_id, question_type_id) do nothing;

insert into questionnaire_template_questions (template_id, question_type_id, default_enabled, default_min, default_max, sort_order)
select t.id, qt.id, true, qt.default_min, qt.default_max, row_number() over (order by qt.code)
from questionnaire_templates t
cross join question_types qt
where t.name = 'Completo' and t.center_id is null
on conflict (template_id, question_type_id) do nothing;

-- ─── Backfill: espejar la configuración legacy en el modelo nuevo ────────────
-- Para que cualquier lectura futura sobre questionnaire_questions ya refleje
-- el estado real de los procesos existentes, sin tocar questionnaire_settings.
insert into questionnaire_questions (process_id, question_type_id, enabled, min, max, sort_order)
select qs.process_id, qt.id, qs.friendship_enabled, qs.friendship_min, qs.friendship_max, 0
from questionnaire_settings qs
join question_types qt on qt.code = 'friendship'
on conflict (process_id, question_type_id) do nothing;

insert into questionnaire_questions (process_id, question_type_id, enabled, min, max, sort_order)
select qs.process_id, qt.id, qs.work_enabled, qs.work_min, qs.work_max, 1
from questionnaire_settings qs
join question_types qt on qt.code = 'work'
on conflict (process_id, question_type_id) do nothing;

insert into questionnaire_questions (process_id, question_type_id, enabled, min, max, sort_order)
select qs.process_id, qt.id, qs.emotional_enabled, qs.emotional_min, qs.emotional_max, 2
from questionnaire_settings qs
join question_types qt on qt.code = 'emotional'
on conflict (process_id, question_type_id) do nothing;

insert into questionnaire_questions (process_id, question_type_id, enabled, min, max, sort_order)
select qs.process_id, qt.id, qs.negative_enabled, 0, qs.negative_max, 3
from questionnaire_settings qs
join question_types qt on qt.code = 'negative'
on conflict (process_id, question_type_id) do nothing;
