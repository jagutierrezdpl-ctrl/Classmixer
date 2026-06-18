# PLAN: Plataforma de Encuestas Escolares
## Documento de especificación y base técnica
### Basado en los aprendizajes de ClassMixer

---

## 0. Concepto de la aplicación

Una plataforma SaaS multi-tenant para que centros educativos lancen cuestionarios a cualquier colectivo (alumnos, familias, profesores), recojan respuestas, analicen resultados con IA y mantengan un historial longitudinal por curso escolar.

**Caso de uso central:** Evaluación de la práctica docente — los alumnos valoran a cada profesor por asignatura, y el director/jefe de estudios ve un dashboard con evolución histórica.

**Otros casos de uso:** clima de aula, satisfacción de familias, autoevaluación del profesorado, detección de necesidades de formación, evaluación de proyectos.

---

## 1. Nombre provisional

**EduPulso** (interno)

Posibles nombres comerciales:
- EduPulso
- VozEscolar
- EduVoz
- PulsoAula
- SchoolVoice

---

## 2. Stack tecnológico exacto

### Mismo stack que ClassMixer — no cambiar nada

| Capa | Tecnología | Versión exacta |
|---|---|---|
| Framework | Next.js | 15.x (App Router) |
| Lenguaje | TypeScript | ^5 |
| Estilos | Tailwind CSS | ^4 |
| Componentes UI | shadcn/ui + Radix UI | última |
| Estado servidor | TanStack Query | ^5 |
| Formularios | React Hook Form | ^7 |
| Validación | Zod | ^4 |
| Base de datos | Supabase (PostgreSQL) | última |
| Auth | Supabase Auth | @supabase/ssr ^0.12 |
| Gráficos | Recharts | ^3 |
| Excel import/export | xlsx + exceljs | latest |
| PDF | @react-pdf/renderer | ^4 |
| Iconos | lucide-react | ^1 |
| Toast | sonner | ^2 |
| QR | qrcode.react | ^4 |
| Email | resend | ^6 |
| IA | @anthropic-ai/sdk | última |
| Hosting | Vercel + Supabase | — |

**NO usar** Cytoscape.js — no hay sociograma en esta app.

**SÍ añadir** explícitamente:
```bash
npm install @anthropic-ai/sdk
```

### Comando de creación del proyecto

```bash
npx create-next-app@latest edupulso \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*"
```

Después:
```bash
npx shadcn@latest init
```

---

## 3. Variables de entorno

Crear `.env.local` desde el primer día:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# IA
ANTHROPIC_API_KEY=sk-ant-...

# Email
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@edupulso.es

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**NUNCA** exponer `SUPABASE_SERVICE_ROLE_KEY` al cliente. Solo tiene prefijo `NEXT_PUBLIC_` la URL y la clave anon.

---

## 4. Estructura de carpetas

```
/src
  /app
    /(auth)
      /login
      /register
      /forgot-password
      /set-password
    /(dashboard)
      /dashboard          → inicio admin
      /surveys            → listado de encuestas
      /surveys/[id]       → detalle encuesta
        /configure        → configuración preguntas
        /respondents      → gestión de destinatarios
        /assignments      → asignaciones (práctica docente)
        /responses        → respuestas recibidas
        /results          → dashboard de resultados
        /export           → exportaciones
      /surveys/new        → crear nueva encuesta
      /templates          → plantillas de cuestionarios
      /reports            → historial y comparativas
      /users              → gestión de usuarios del centro
      /settings           → configuración del centro
      /ai-analysis        → análisis con IA
    /(superadmin)
      /superadmin
        /centers          → gestión de centros
        /licenses         → gestión de licencias
        /stats            → métricas globales
    /q
      /[token]            → página pública de respuesta (sin login)
    /api
      /auth
      /surveys
      /surveys/[id]
        /configure
        /respondents
        /assignments
        /responses
        /results
        /export
        /ai-analysis
      /templates
      /notifications
        /inbox
      /centers            → superadmin
  /components
    /ui                   → shadcn/ui base (no tocar)
    /surveys
    /questionnaire
    /results
    /charts
    /respondents
    /assignments
    /exports
    /notifications
    /layout
  /lib
    /supabase
      /server.ts          → createClient() + createServiceClient()
    /auth.ts              → getUserProfile, requireAuth, logAudit, hasAccess
    /notifications.ts     → pushNotification() fire-and-forget
    /ai.ts                → analyzeResults() con Claude
    /excel.ts             → import/export xlsx
    /pdf.ts               → generación PDF
    /scoring.ts           → cálculo de medias, percentiles, tendencias
  /types
    /index.ts             → tipos TypeScript globales
    /database.ts          → tipos generados por Supabase (NO editar a mano)
  /schemas
    /index.ts             → schemas Zod para formularios
  /hooks                  → custom hooks TanStack Query
  /utils
    /cn.ts                → clsx + tailwind-merge
```

---

## 5. Patrones críticos — aprendidos en ClassMixer

Esta sección es la más importante. Cada punto previene horas de debugging.

---

### 5.1 Dos clientes Supabase distintos — NUNCA confundirlos

```typescript
// src/lib/supabase/server.ts

// CLIENTE NORMAL — usa clave anon — RESPETA RLS
// Usar en: Server Components, getUserProfile()
export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll(c) { try { c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {} } } }
  )
}

// CLIENTE SERVICE ROLE — bypass RLS completo
// Usar en: TODAS las API routes (app/api/**/route.ts)
export function createServiceClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}
```

**Regla:** Si el archivo está en `app/api/`, usar `createServiceClient()`. Si está en `app/(dashboard)/`, usar `createClient()`.

---

### 5.2 getUserProfile — patrón correcto

```typescript
export async function getUserProfile(): Promise<UserProfile | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // IMPORTANTE: usar serviceClient aquí, no el client normal
  // La tabla users puede tener RLS que bloquee la lectura del propio perfil
  const serviceClient = createServiceClient()
  const { data: profile } = await serviceClient
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single()

  return profile
}
```

---

### 5.3 logAudit — firma POSICIONAL (no objeto)

```typescript
// CORRECTO ✅
await logAudit(profile.id, profile.center_id, "action_name", "entity_type", {
  entityId: someId,
  processId: surveyId,
  metadata: { key: value },
})

// INCORRECTO ❌ — no existe esta firma
await logAudit({ userId: profile.id, centerId: profile.center_id, ... })
```

```typescript
export async function logAudit(
  userId: string,
  centerId: string,
  action: string,
  entityType: string,
  options?: { surveyId?: string; entityId?: string; metadata?: Record<string, unknown> }
) {
  const supabase = await createClient()
  await supabase.from("audit_logs").insert({
    user_id: userId,
    center_id: centerId,
    action,
    entity_type: entityType,
    survey_id: options?.surveyId,
    entity_id: options?.entityId,
    metadata: options?.metadata ?? null,
  })
}
```

---

### 5.4 Next.js 15 — params es Promise

```typescript
// CORRECTO ✅ — params es Promise en Next.js 15
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params  // ← await obligatorio
  ...
}

// INCORRECTO ❌ — Next.js 14 style
export async function GET(req, { params }) {
  const { id } = params  // ← error silencioso en Next.js 15
}
```

---

### 5.5 Tipos Supabase para tablas nuevas — patrón `as any`

Cuando se crea una migración nueva con tablas que no están en `database.ts` (porque los tipos aún no se han regenerado):

```typescript
/* eslint-disable @typescript-eslint/no-explicit-any */

// Usar hasta regenerar tipos con: supabase gen types typescript
const { data } = await (supabase as any)
  .from("nueva_tabla")
  .select("*")
  .eq("survey_id", surveyId)
```

**Cuando aplicar el tipo real:** después de ejecutar en Supabase SQL Editor y regenerar:
```bash
npx supabase gen types typescript --project-id XXXX > src/types/database.ts
```

---

### 5.6 RLS — configurar desde el día 1

**Regla de oro:** Cada tabla que tenga `center_id` necesita RLS desde su migración inicial.

Patrón de RLS para esta app:

```sql
-- Activar RLS
ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;

-- Service role lo ve todo (para API routes)
CREATE POLICY "service_role_bypass" ON survey_responses
  USING (true)
  WITH CHECK (true);
-- ↑ Esto no es necesario si usas service_role key — bypassa RLS automáticamente.
-- Pero es bueno tenerlo para claridad.

-- Los usuarios autenticados solo ven su centro
CREATE POLICY "center_isolation" ON survey_responses
  FOR ALL
  USING (
    center_id = (
      SELECT center_id FROM users WHERE id = auth.uid()
    )
  );
```

**Nunca** confiar en `center_id` enviado desde el cliente. Siempre leerlo del perfil:
```typescript
const profile = await getUserProfile()
// usar profile.center_id, NUNCA req.body.center_id
```

---

### 5.7 Migraciones SQL — convención de nombres

```
001_initial_schema.sql    → tablas base: users, centers, surveys
002_rls_policies.sql      → todas las RLS juntas
003_licenses.sql          → sistema de licencias
004_respondents.sql       → tabla de destinatarios
005_assignments.sql       → asignaciones survey-respondent
006_responses.sql         → tabla de respuestas
007_results_cache.sql     → caché de resultados calculados
008_notifications.sql     → app_notifications
009_audit_logs.sql        → audit_logs
010_templates.sql         → plantillas de cuestionarios
```

**En cada migración:**
- Siempre `IF NOT EXISTS` en CREATE TABLE
- Siempre `IF NOT EXISTS` en CREATE INDEX
- Siempre `IF NOT EXISTS` en ALTER TABLE ADD COLUMN
- Siempre activar RLS + policies en la misma migración

---

### 5.8 pushNotification — fire-and-forget

```typescript
// src/lib/notifications.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

export async function pushNotification(params: {
  centerId: string
  type: string
  title: string
  message: string
  surveyId?: string
  entityId?: string
  userId?: string
}): Promise<void> {
  try {
    const supabase = createServiceClient() as any
    await supabase.from("app_notifications").insert({
      center_id: params.centerId,
      user_id: params.userId ?? null,
      type: params.type,
      title: params.title,
      message: params.message,
      entity_id: params.entityId ?? null,
      survey_id: params.surveyId ?? null,
      read: false,
    })
  } catch {
    // Non-critical — never break main flow
  }
}
```

**Usar siempre como:**
```typescript
// No await, no manejo de error — fire and forget
pushNotification({ centerId, type: "survey_complete", ... }).catch(() => {})
```

---

### 5.9 Middleware de autenticación

```typescript
// src/middleware.ts
const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/register",
  "/q",           // página pública de respuesta
  "/api/q/",      // API pública de respuesta
  "/pending",
  "/inactive",
  "/api/auth/",
  "/forgot-password",
  "/set-password",
  "/demo",
]
```

**Añadir siempre `/q` y `/api/q/` como rutas públicas desde el inicio** — si no, los alumnos/familias sin cuenta no pueden responder.

---

### 5.10 Imports dinámicos para componentes pesados

```typescript
// Recharts y otros componentes pesados: importar dinámicamente
import dynamic from "next/dynamic"

const ResultsChart = dynamic(() => import("@/components/results/ResultsChart"), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse bg-gray-100 rounded-xl" />
})
```

---

### 5.11 TanStack Query — patrón estándar

```typescript
// Hook de lectura
export function useSurveyResults(surveyId: string) {
  return useQuery({
    queryKey: ["survey-results", surveyId],
    queryFn: async () => {
      const res = await fetch(`/api/surveys/${surveyId}/results`)
      if (!res.ok) throw new Error("Error cargando resultados")
      return res.json()
    },
    enabled: !!surveyId,
  })
}

// Hook de mutación
export function useSubmitResponse(surveyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: ResponsePayload) => {
      const res = await fetch(`/api/surveys/${surveyId}/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error("Error enviando respuesta")
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["survey-results", surveyId] })
    },
  })
}
```

---

### 5.12 Supabase Auth — trigger para crear perfil de usuario

```sql
-- Trigger para crear automáticamente el perfil al registrarse
-- Sin esto, getUserProfile() devuelve null para usuarios nuevos

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role, center_id, active)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'viewer'),
    (NEW.raw_user_meta_data->>'center_id')::uuid,
    true
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

**Error frecuente:** Si el trigger falla silenciosamente, el usuario queda registrado en `auth.users` pero sin perfil en `users`. Añadir siempre `ON CONFLICT (id) DO NOTHING`.

---

## 6. Errores específicos cometidos en ClassMixer — no repetir

| Error | Causa | Solución definitiva |
|---|---|---|
| `logAudit` llamado con objeto `{userId, centerId}` | Confusión de firma | Firma siempre posicional: `logAudit(userId, centerId, action, type, opts?)` |
| `params.id` sin await en Next.js 15 | Cambio breaking de Next.js 15 | `const { id } = await params` siempre |
| Tipos Supabase rotos tras migración | Tipos no regenerados | Añadir `/* eslint-disable */` + `as any` hasta regenerar |
| RLS añadida tarde — reescritura costosa | Setup tardío | RLS obligatoria en la migración `001_` |
| `choice_received_count` vs `received_count` | Nombre de campo equivocado | Revisar tipos generados antes de usar campos |
| Import duplicado de icono Lucide | Alias innecesario | Usar el mismo nombre, no crear alias |
| `createClient()` en API routes | Cliente incorrecto | API routes siempre `createServiceClient()` |
| Tabla nueva sin `IF NOT EXISTS` | Migración falla si ya existe | Siempre `IF NOT EXISTS` en migraciones |
| Componente pesado causa error SSR | Recharts/Cytoscape en server | `dynamic(() => import(...), { ssr: false })` |
| `center_id` leído del body del request | Vulnerability: cross-tenant | Solo de `profile.center_id`, nunca del body |

---

## 7. Modelo de datos

### Tablas base (mismas que ClassMixer)

#### users
```sql
CREATE TABLE users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'viewer'
    CHECK (role IN ('superadmin', 'admin', 'teacher', 'viewer')),
  center_id uuid REFERENCES centers(id) ON DELETE CASCADE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

#### centers
```sql
CREATE TABLE centers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  slug text UNIQUE,
  city text,
  country text DEFAULT 'ES',
  logo_url text,
  openrouter_key text,         -- clave IA del centro (si tienen la suya)
  ai_model text DEFAULT 'claude-sonnet-4-6',
  active boolean NOT NULL DEFAULT false, -- superadmin lo activa
  created_at timestamptz DEFAULT now()
);
```

#### licenses
```sql
CREATE TABLE licenses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  center_id uuid UNIQUE NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free'
    CHECK (plan IN ('free', 'starter', 'pro', 'enterprise')),
  max_surveys integer,         -- null = ilimitado
  max_respondents integer,
  max_responses_per_month integer,
  ai_enabled boolean DEFAULT false,
  historical_enabled boolean DEFAULT false,
  active boolean DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);
```

#### audit_logs
```sql
CREATE TABLE audit_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES users(id),
  center_id uuid REFERENCES centers(id),
  survey_id uuid,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);
```

#### app_notifications
```sql
CREATE TABLE app_notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  center_id uuid NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  entity_id uuid,
  survey_id uuid REFERENCES surveys(id) ON DELETE CASCADE,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);
```

---

### Tablas nuevas específicas de esta app

#### surveys (equivale a `processes` en ClassMixer)
```sql
CREATE TABLE surveys (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  center_id uuid NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  school_year text NOT NULL,       -- "2025/2026"
  survey_type text NOT NULL        -- 'teacher_evaluation' | 'climate' | 'satisfaction' | 'custom'
    CHECK (survey_type IN ('teacher_evaluation', 'climate', 'satisfaction', 'needs', 'custom')),
  respondent_type text NOT NULL    -- 'students' | 'families' | 'teachers' | 'mixed'
    CHECK (respondent_type IN ('students', 'families', 'teachers', 'mixed')),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'open', 'closed', 'analyzing', 'published', 'archived')),
  template_id uuid REFERENCES survey_templates(id),
  parent_survey_id uuid REFERENCES surveys(id), -- para comparativas inter-anuales
  open_at timestamptz,
  close_at timestamptz,
  allow_anonymous boolean DEFAULT false,
  require_all_questions boolean DEFAULT false,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

#### survey_questions
```sql
CREATE TABLE survey_questions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  survey_id uuid NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  order_index integer NOT NULL DEFAULT 0,
  type text NOT NULL
    CHECK (type IN ('scale', 'multiple_choice', 'single_choice', 'text', 'yes_no', 'nps')),
  label text NOT NULL,
  description text,
  required boolean DEFAULT true,
  scale_min integer DEFAULT 1,
  scale_max integer DEFAULT 5,
  scale_min_label text DEFAULT 'Muy en desacuerdo',
  scale_max_label text DEFAULT 'Muy de acuerdo',
  options jsonb,  -- para multiple_choice/single_choice: [{value, label}]
  category text,  -- agrupación: 'metodologia', 'comunicacion', 'clima', etc.
  created_at timestamptz DEFAULT now()
);
```

#### respondents (alumnos, familias, profesores del centro)
```sql
CREATE TABLE respondents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  center_id uuid NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('student', 'family', 'teacher', 'staff')),
  first_name text NOT NULL,
  last_name text,
  email text,
  group_name text,               -- clase o curso: "1ºA", "2ºB"
  subject text,                  -- para profesores: asignatura principal
  school_year text,              -- curso al que pertenece
  external_id text,              -- ID del sistema del colegio
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
```

#### survey_tokens (equivale a `questionnaire_tokens` en ClassMixer)
```sql
CREATE TABLE survey_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  survey_id uuid NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  respondent_id uuid REFERENCES respondents(id) ON DELETE CASCADE,
  assignment_id uuid,            -- FK a survey_assignments si aplica
  token text NOT NULL UNIQUE,
  used boolean DEFAULT false,
  completed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);
```

#### survey_assignments (clave para práctica docente)
```sql
-- Define QUIÉN responde sobre QUÉ/QUIÉN
-- Ejemplo: el grupo "1ºA" evalúa al profesor "Juan García" en la asignatura "Matemáticas"
CREATE TABLE survey_assignments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  survey_id uuid NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  respondent_group text,         -- clase que responde: "1ºA"
  subject_teacher_id uuid REFERENCES respondents(id), -- profesor evaluado
  subject_name text,             -- asignatura: "Matemáticas"
  context_label text,            -- etiqueta libre para el respondente
  created_at timestamptz DEFAULT now()
);
```

#### responses
```sql
CREATE TABLE responses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  survey_id uuid NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES survey_questions(id) ON DELETE CASCADE,
  respondent_id uuid REFERENCES respondents(id),
  assignment_id uuid REFERENCES survey_assignments(id),
  token_id uuid REFERENCES survey_tokens(id),
  value_numeric numeric,         -- para scale, nps
  value_text text,               -- para text
  value_option text,             -- para single_choice
  value_options jsonb,           -- para multiple_choice: ["a","b"]
  anonymous boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
```

#### results_cache (evitar recalcular en cada visita)
```sql
CREATE TABLE results_cache (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  survey_id uuid NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  assignment_id uuid REFERENCES survey_assignments(id),
  question_id uuid REFERENCES survey_questions(id),
  metric_key text NOT NULL,      -- 'mean', 'median', 'count', 'nps_score', 'distribution'
  metric_value numeric,
  metric_json jsonb,
  computed_at timestamptz DEFAULT now(),
  UNIQUE(survey_id, assignment_id, question_id, metric_key)
);
```

#### survey_templates
```sql
CREATE TABLE survey_templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  center_id uuid REFERENCES centers(id), -- null = plantilla global del sistema
  name text NOT NULL,
  description text,
  survey_type text NOT NULL,
  respondent_type text NOT NULL,
  is_system boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE template_questions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id uuid NOT NULL REFERENCES survey_templates(id) ON DELETE CASCADE,
  order_index integer NOT NULL DEFAULT 0,
  type text NOT NULL,
  label text NOT NULL,
  description text,
  required boolean DEFAULT true,
  scale_min integer DEFAULT 1,
  scale_max integer DEFAULT 5,
  scale_min_label text,
  scale_max_label text,
  options jsonb,
  category text
);
```

---

## 8. Roles de usuario

| Rol | Acceso |
|---|---|
| `superadmin` | Todos los centros, licencias, stats globales |
| `admin` | Su centro completo — crea encuestas, gestiona usuarios, ve resultados |
| `teacher` | Solo las encuestas donde es evaluado o asignado como evaluador; ve sus propios resultados |
| `viewer` | Lee resultados específicos si se le da acceso explícito |

**No hay rol "alumno" con cuenta.** Los alumnos/familias responden vía token (enlace único), sin crear cuenta. Mismo patrón que ClassMixer con `/q/[token]`.

---

## 9. API Routes principales

### Surveys
```
GET    /api/surveys                    → lista del centro
POST   /api/surveys                    → crear encuesta
GET    /api/surveys/[id]               → detalle
PATCH  /api/surveys/[id]               → actualizar
DELETE /api/surveys/[id]               → archivar

POST   /api/surveys/[id]/questions     → añadir pregunta
PATCH  /api/surveys/[id]/questions/[qid]
DELETE /api/surveys/[id]/questions/[qid]
POST   /api/surveys/[id]/questions/reorder

POST   /api/surveys/[id]/assignments   → configurar asignaciones (práctica docente)
GET    /api/surveys/[id]/assignments

POST   /api/surveys/[id]/tokens/generate  → generar tokens para respondentes
GET    /api/surveys/[id]/tokens           → estado de participación
POST   /api/surveys/[id]/open             → activar encuesta
POST   /api/surveys/[id]/close            → cerrar encuesta

GET    /api/surveys/[id]/responses        → respuestas recibidas
GET    /api/surveys/[id]/results          → resultados calculados
POST   /api/surveys/[id]/results/compute  → recalcular caché
GET    /api/surveys/[id]/compare/[otherId]  → comparativa inter-anual

POST   /api/surveys/[id]/ai-analysis      → análisis con Claude
GET    /api/surveys/[id]/export/excel
GET    /api/surveys/[id]/export/pdf
```

### Respuesta pública (sin auth)
```
GET    /api/q/[token]                  → cargar encuesta pública
POST   /api/q/[token]                  → enviar respuestas
```

### Respondentes
```
GET    /api/respondents                → lista del centro
POST   /api/respondents/import         → importar desde Excel
POST   /api/respondents                → crear uno
PATCH  /api/respondents/[id]
DELETE /api/respondents/[id]
```

### Templates
```
GET    /api/templates                  → globales + del centro
POST   /api/templates                  → crear plantilla personalizada
POST   /api/surveys/[id]/apply-template  → aplicar plantilla a encuesta
```

### Superadmin
```
GET    /api/admin/centers
POST   /api/admin/centers
PATCH  /api/admin/centers/[id]
POST   /api/admin/centers/[id]/activate
POST   /api/admin/centers/[id]/assign-admin

GET    /api/admin/licenses
PATCH  /api/admin/licenses/[centerId]
```

---

## 10. Caso de uso: Evaluación de la práctica docente

Este es el caso de uso más complejo. Requiere el modelo de `survey_assignments`.

### Flujo completo

1. **Admin crea encuesta** de tipo `teacher_evaluation` con respondente `students`
2. **Admin configura asignaciones:**
   - Importa lista de profesores (o los toma de `respondents` tipo `teacher`)
   - Para cada par (grupo-clase, profesor, asignatura) crea un `survey_assignment`
   - Ejemplo: `[{group: "1ºA", teacher: "Juan García", subject: "Mates"}, ...]`
3. **Sistema genera tokens:**
   - Un token por alumno del grupo + asignación
   - Alumno de 1ºA recibe tantos tokens como profesores tenga asignados
   - Cada token tiene su `assignment_id` para saber qué profesor/asignatura evalúa
4. **Alumno responde:**
   - Entra a `/q/[token]`
   - Ve las preguntas con contexto: "Valora a Juan García en Matemáticas"
   - Responde y envía
5. **Resultados:**
   - Dashboard por profesor: media de cada pregunta, por curso, comparativa anual
   - Dashboard por asignatura: ¿qué asignaturas tienen mejor/peor valoración?
   - Dashboard por grupo: ¿qué grupos valoran mejor/peor?
   - El profesor solo ve SUS resultados
   - El director ve todos

### Pantalla de configuración de asignaciones

```
Configurar asignaciones
━━━━━━━━━━━━━━━━━━━━━━

Importar desde Excel  |  Añadir manualmente

┌─────────────────┬──────────────────┬──────────────┐
│ Grupo / Clase   │ Profesor         │ Asignatura   │
├─────────────────┼──────────────────┼──────────────┤
│ 1ºA             │ Juan García      │ Matemáticas  │
│ 1ºA             │ María López      │ Lengua       │
│ 1ºB             │ Juan García      │ Matemáticas  │
│ 2ºA             │ Carlos Ruiz      │ Historia     │
└─────────────────┴──────────────────┴──────────────┘

Total: 42 combinaciones → 840 tokens a generar (20 alumnos por grupo)
```

---

## 11. Dashboard de resultados

### Vista general de la encuesta
- Tarjeta por pregunta: media, distribución de respuestas (barras)
- Filtros: por grupo, por asignatura, por fecha
- Participación: % de completado, alumnos pendientes

### Vista por profesor (práctica docente)
- Una fila por profesor con media general
- Expandir: ver pregunta a pregunta
- Comparativa: vs. media del centro, vs. año anterior

### Vista histórica (multi-curso)
- Línea de evolución por curso escolar
- Por profesor, por asignatura, por grupo
- Requiere `parent_survey_id` para vincular encuestas anuales

### Componentes de chart (Recharts)
```typescript
// Usar siempre con dynamic import
const BarChart = dynamic(() => import("recharts").then(m => ({ default: m.BarChart })), { ssr: false })

// Tipos principales a usar:
// BarChart — distribución de respuestas
// RadarChart — perfil multidimensional por pregunta
// LineChart — evolución histórica
// PieChart — distribución de opciones
```

---

## 12. Análisis con IA

### Patrón Claude en API Route

```typescript
// src/app/api/surveys/[id]/ai-analysis/route.ts
import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: surveyId } = await params
  const profile = await getUserProfile()
  if (!profile || !["admin", "superadmin"].includes(profile.role)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 })
  }

  // Construir el payload de resultados
  const results = await getResultsSummary(surveyId)

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [{
      role: "user",
      content: `Analiza los resultados de esta encuesta escolar y proporciona:
1. Resumen ejecutivo (3-4 frases)
2. Puntos fuertes detectados
3. Áreas de mejora prioritarias
4. Recomendaciones concretas para el equipo directivo

Datos: ${JSON.stringify(results, null, 2)}`
    }]
  })

  await logAudit(profile.id, profile.center_id, "ai_analysis", "survey", { entityId: surveyId })

  return NextResponse.json({
    analysis: message.content[0].type === "text" ? message.content[0].text : "",
  })
}
```

### Buenas prácticas de IA
- Siempre mostrar como "análisis orientativo, no diagnóstico"
- Guardar el análisis en BD para no regenerar en cada visita
- Registrar en `audit_logs` cada vez que se genera análisis
- Si el centro no tiene `ANTHROPIC_API_KEY`, usar su propia key de `centers.openrouter_key`

---

## 13. Importación de respondentes desde Excel

```typescript
// src/lib/excel.ts
import * as XLSX from "xlsx"

export interface RespondentRow {
  first_name: string
  last_name?: string
  email?: string
  group_name?: string
  subject?: string
  external_id?: string
  type: "student" | "family" | "teacher"
}

export function parseRespondentsExcel(buffer: ArrayBuffer): {
  rows: RespondentRow[]
  errors: string[]
} {
  const workbook = XLSX.read(buffer)
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[]

  const errors: string[] = []
  const rows: RespondentRow[] = []

  raw.forEach((row, i) => {
    if (!row.nombre && !row.first_name) {
      errors.push(`Fila ${i + 2}: falta el nombre`)
      return
    }
    rows.push({
      first_name: String(row.nombre ?? row.first_name ?? ""),
      last_name: String(row.apellidos ?? row.last_name ?? ""),
      email: row.email ? String(row.email) : undefined,
      group_name: row.clase ?? row.grupo ?? row.group ? String(row.clase ?? row.grupo ?? row.group) : undefined,
      external_id: row.id ? String(row.id) : undefined,
      type: "student",
    })
  })

  return { rows, errors }
}
```

---

## 14. Fases de desarrollo

### Fase 1 — Fundación (semanas 1-2)

- [ ] `npx create-next-app@latest` con TypeScript + Tailwind
- [ ] shadcn/ui init
- [ ] Configurar Supabase (proyecto, env vars)
- [ ] Migración `001_initial_schema.sql` — tablas: centers, users, licenses, audit_logs
- [ ] Migración `002_rls_policies.sql` — RLS por center_id
- [ ] Trigger `handle_new_user`
- [ ] Middleware de auth
- [ ] Layout base dashboard (sidebar, navbar)
- [ ] Login + registro
- [ ] Panel superadmin: CRUD centros + activar/desactivar
- [ ] Panel superadmin: asignar admin a centro

### Fase 2 — Encuestas básicas (semanas 3-4)

- [ ] Migración `003_surveys.sql` — tabla surveys, questions
- [ ] CRUD de encuestas
- [ ] Editor de preguntas (drag para reordenar, tipos scale/text/choice)
- [ ] Plantillas del sistema (3-4 plantillas predefinidas)
- [ ] Importar respondentes desde Excel
- [ ] Generar tokens y enlace/QR
- [ ] Página pública `/q/[token]` — responder encuesta sin cuenta
- [ ] Panel admin: % de participación en tiempo real

### Fase 3 — Resultados y dashboard (semanas 5-6)

- [ ] Migración `004_results_cache.sql`
- [ ] Endpoint `/results/compute` — calcular medias, distribuciones
- [ ] Dashboard: bar chart por pregunta, radar general, participación
- [ ] Filtros: por grupo, por asignatura
- [ ] Exportación Excel con resultados
- [ ] Notificaciones en-app (survey complete, baja participación)

### Fase 4 — Práctica docente (semanas 7-8)

- [ ] Migración `005_assignments.sql`
- [ ] Pantalla de configuración de asignaciones
- [ ] Importar asignaciones desde Excel
- [ ] Generar tokens por alumno+asignación
- [ ] Dashboard por profesor — cada profesor ve solo sus resultados
- [ ] Dashboard dirección — todos los profesores comparados

### Fase 5 — Historial y comparativas (semanas 9-10)

- [ ] Campo `parent_survey_id` en surveys
- [ ] Crear encuesta de "repetición anual" enlazada a la anterior
- [ ] LineChart de evolución por curso escolar
- [ ] Comparativa lado a lado: año actual vs. año anterior
- [ ] Exportación PDF de informe histórico

### Fase 6 — IA y análisis avanzado (semanas 11-12)

- [ ] Integración Anthropic SDK
- [ ] Endpoint `/ai-analysis` — análisis por encuesta
- [ ] Análisis por profesor (si es práctica docente)
- [ ] Guardar análisis en BD para no regenerar
- [ ] UI: resumen IA en dashboard + indicador "generado por IA"

### Fase 7 — Multi-tenant completo y SaaS (semanas 13+)

- [ ] Gestión completa de licencias desde superadmin
- [ ] Límites por plan (max_surveys, max_respondents, ai_enabled)
- [ ] Portal de onboarding para nuevos centros
- [ ] Históricos inter-anuales completos
- [ ] Panel de auditoría por centro

---

## 15. Setup inicial — checklist día 1

```bash
# 1. Crear proyecto
npx create-next-app@latest edupulso --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
cd edupulso

# 2. shadcn/ui
npx shadcn@latest init

# 3. Dependencias
npm install @supabase/supabase-js @supabase/ssr @tanstack/react-query @tanstack/react-query-devtools react-hook-form @hookform/resolvers zod recharts @react-pdf/renderer xlsx exceljs qrcode.react sonner lucide-react resend @anthropic-ai/sdk

# 4. Dev dependencies
npm install -D @types/node

# 5. Crear estructura de carpetas (mkdir -p de todo)
mkdir -p src/lib/supabase src/types src/schemas src/hooks src/utils

# 6. Crear src/lib/supabase/server.ts (COPIAR exacto de ClassMixer)
# 7. Crear src/lib/auth.ts (COPIAR y adaptar de ClassMixer)
# 8. Crear src/middleware.ts (COPIAR y adaptar de ClassMixer)
# 9. Crear src/utils/cn.ts
# 10. Crear src/lib/notifications.ts (COPIAR exacto de ClassMixer)
```

### Variables de entorno — verificar antes de continuar
```bash
# Comprobar que las env vars están disponibles
node -e "require('dotenv').config({path:'.env.local'}); console.log(process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Supabase OK' : '❌ Supabase MISSING')"
```

---

## 16. Principios no negociables

1. **RLS desde el día 1.** Cada tabla nueva lleva su policy en la misma migración. Añadirla después cuesta el doble.

2. **`createServiceClient()` en todas las API routes.** Sin excepción. `createClient()` solo en server components y `getUserProfile()`.

3. **El `center_id` nunca viene del cliente.** Solo de `profile.center_id` (leído del servidor).

4. **`params` siempre con `await` en Next.js 15.**

5. **Los respondentes (alumnos/familias) nunca ven datos de otros.** El token solo da acceso a su propia encuesta.

6. **Los profesores solo ven sus propios resultados.** El admin ve todos.

7. **La IA analiza, el director decide.** Nunca presentar el análisis de IA como diagnóstico definitivo.

8. **Audit log en toda acción sensible:** ver resultados de un profesor, exportar datos, generar análisis IA.

9. **Datos de menores = mínimos.** Pedir solo nombre + clase. No necesitamos ni fecha de nacimiento.

10. **Notificaciones fire-and-forget.** Nunca bloquear la respuesta principal por un fallo de notificación.

---

## 17. Diferencias clave vs. ClassMixer

| Aspecto | ClassMixer | Esta app |
|---|---|---|
| Propósito | Mezcla de clases + sociograma | Encuestas multi-propósito |
| Visualización | Cytoscape.js (grafo) | Recharts (charts) |
| Respondentes | Solo alumnos | Alumnos, familias, profesores |
| Preguntas | Selección de compañeros | Scale, choice, text, NPS |
| Proceso | Único por mezcla | Múltiples encuestas repetibles |
| Historial | No explícito | Core feature — evolución anual |
| IA | Análisis de sociograma | Análisis de resultados de encuestas |
| Algoritmo | Heurístico de distribución | No hay — solo análisis estadístico |
| Tokens | Un token por alumno | Un token por alumno × asignación |

---

## 18. Plantillas del sistema incluidas desde el inicio

| Nombre | Tipo | Respondentes | Preguntas |
|---|---|---|---|
| Evaluación de la práctica docente | teacher_evaluation | students | 10 ítems escala 1-5 por dimensión |
| Clima de aula | climate | students | 8 ítems escala + 2 abiertas |
| Satisfacción de familias | satisfaction | families | 12 ítems escala + NPS |
| Necesidades de formación del profesorado | needs | teachers | 15 ítems + elección múltiple |
| Autoevaluación del profesorado | custom | teachers | 10 ítems reflexivos |

---

*Documento generado el 18/06/2026 como base para la nueva aplicación de encuestas escolares.*
*Basado en los aprendizajes y patrones de ClassMixer.*
