# ClassMixer — Registro de desarrollo

Documento de referencia con todo lo implementado por fase.

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 15 + TypeScript + Tailwind CSS + shadcn/ui |
| Estado servidor | TanStack Query |
| Formularios | React Hook Form + Zod |
| Grafos | Cytoscape.js |
| Backend | Next.js API Routes |
| Base de datos | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Excel | xlsx |
| Algoritmo | Heurística propia (snake + búsqueda local) |

---

## FASE 1 — MVP funcional ✅

### Setup y estructura

- Proyecto Next.js 15 con TypeScript, Tailwind, shadcn/ui
- Variables de entorno Supabase (`.env.local`)
- Middleware de autenticación y protección de rutas
- Layout del dashboard: sidebar, navbar, breadcrumbs
- Tipos TypeScript completos en `src/types/index.ts`
- Schemas Zod en `src/schemas/`

### Base de datos (Supabase/PostgreSQL)

Tablas creadas con RLS por `center_id`:

- `centers` — centros educativos
- `users` — usuarios con roles
- `processes` — procesos de mezcla
- `students` — alumnos por proceso
- `questionnaire_settings` — configuración del cuestionario
- `questionnaire_tokens` — tokens de acceso individuales
- `responses` — respuestas sociométricas
- `rules` + `rule_students` — reglas pedagógicas
- `proposals` — propuestas generadas
- `proposal_assignments` — asignación alumno → clase
- `proposal_metrics` — métricas por clase y propuesta
- `sociogram_metrics` — métricas calculadas del sociograma
- `audit_logs` — registro de auditoría

### Autenticación y roles

- Login con email/contraseña (Supabase Auth)
- Roles: `superadmin | admin | tutor | orientador | alumno`
- Guard de acceso por rol en cada ruta
- `getUserProfile()` y `logAudit()` en `src/lib/auth.ts`

### Gestión de procesos

**Archivos clave:**
- `src/app/(dashboard)/processes/page.tsx` — listado con estados visuales
- `src/app/(dashboard)/processes/new/page.tsx` — formulario de creación
- `src/app/(dashboard)/processes/[id]/page.tsx` — detalle del proceso
- `src/app/api/processes/route.ts` — GET (lista) + POST (crear)
- `src/app/api/processes/[id]/route.ts` — GET + PATCH + DELETE

**Estados del proceso:** borrador → cuestionario_abierto → cuestionario_cerrado → en_análisis → propuestas_generadas → propuesta_seleccionada → cerrado → archivado

### Importación de alumnos (Excel)

**Archivos clave:**
- `src/lib/excel/import.ts` — parser xlsx + validaciones
- `src/app/api/processes/[id]/students/route.ts` — upload + confirm
- `src/app/(dashboard)/processes/[id]/students/page.tsx` — tabla con filtros

**Funcionalidades:**
- Drag & drop para subir Excel
- Validaciones: IDs duplicados, columnas obligatorias, nota numérica, género
- Pantalla de revisión previa: totales, errores, advertencias, distribución
- Descarga de plantilla Excel
- Confirmación e inserción en DB
- Tabla filtrable por nombre, clase, género, nivel, conducta

### Cuestionario sociométrico

**Archivos clave:**
- `src/app/(dashboard)/processes/[id]/questionnaire/page.tsx` — configuración admin
- `src/app/api/processes/[id]/questionnaire/settings/route.ts`
- `src/app/api/processes/[id]/questionnaire/generate/route.ts`
- `src/app/q/[token]/page.tsx` — interfaz pública del alumno
- `src/app/api/q/[token]/route.ts` — GET (cargar) + POST (enviar)

**Funcionalidades:**
- Activar preguntas: amistad, trabajo, emocional, negativa
- Configurar mínimos y máximos por tipo
- Generación de tokens individuales por alumno
- Generación de enlace general + QR
- Ruta pública `/q/[token]` (sin login)
- Búsqueda de compañeros, selección y envío
- Panel de seguimiento admin: % completado, pendientes

### Sociograma básico

**Archivos clave:**
- `src/lib/sociogram/calculate.ts` — cálculo de métricas
- `src/components/sociogram/SociogramGraph.tsx` — visualización Cytoscape.js
- `src/app/(dashboard)/processes/[id]/sociogram/page.tsx`
- `src/app/api/processes/[id]/sociogram/route.ts`

**Métricas calculadas:**
- Elecciones dadas / recibidas
- Relaciones recíprocas
- Detección de alumnos sin elecciones recibidas

### Reglas simples

**Archivos clave:**
- `src/app/(dashboard)/processes/[id]/rules/page.tsx`
- `src/app/api/processes/[id]/rules/route.ts`
- `src/app/api/rules/[id]/route.ts`

**Tipos de regla implementados:** `must_separate`, `lock_student_to_class`

### Algoritmo heurístico MVP

**Archivo:** `src/lib/algorithm/heuristic.ts`

**Lógica:**
1. Distribución snake por nota media descendente
2. Respeta separaciones obligatorias
3. Respeta bloqueos de clase
4. Evalúa: social (35%) + académico (30%) + género (20%) + conducta (15%)
5. Repite N veces con seed aleatorio, devuelve top 3

### Vista de propuestas y exportación Excel

**Archivos clave:**
- `src/app/(dashboard)/processes/[id]/proposals/page.tsx`
- `src/app/api/processes/[id]/proposals/route.ts`
- `src/app/api/proposals/[id]/route.ts`
- `src/app/api/proposals/[id]/export/route.ts`
- `src/lib/excel/export.ts` — `exportProposalToExcel()`

**Exportación:** clase destino, nombre, apellidos, origen, género, nota, nivel, observaciones

---

## FASE 2 — Sociograma avanzado ✅

### Cálculo avanzado de métricas

**Archivo:** `src/lib/sociogram/calculate.ts` (reescrito)

**Nuevas métricas:**
- **Centralidad de grado** normalizada (0–1)
- **Betweenness centrality** — algoritmo de Brandes O(N·E)
- **Detección de comunidades** — Union-Find sobre pares recíprocos de amistad
- **Detección automática:** aislado, vulnerable, líder, puente, subgrupo cerrado

**Criterios:**
- Aislado: 0 elecciones recibidas
- Vulnerable: solo 1 relación recíproca
- Líder: elecciones recibidas > media + 1.5σ
- Puente: betweenness > 15% del máximo Y conecta ≥ 2 comunidades
- Subgrupo cerrado: comunidad ≥ 3 miembros con < 50% de conexiones externas

### Tipos actualizados

**Archivo:** `src/types/index.ts`

Nuevos campos en `SociogramNode`: `betweenness`, `is_isolated`, `is_vulnerable`, `is_leader`, `is_bridge`

Nuevas interfaces: `SociogramCommunity { id, members, size, is_closed }`

Nuevas métricas globales: `communities_count`, `reciprocal_pairs`

### Visualización avanzada (Cytoscape.js)

**Archivo:** `src/components/sociogram/SociogramGraph.tsx` (reescrito)

**6 modos de color:**
- Por clase de origen
- Por género
- Por nivel académico
- Por comunidad detectada (paleta de 12 colores)
- Por conducta
- Por riesgo social (aislado=rojo, vulnerable=naranja, líder=amarillo, puente=índigo, normal=verde)

**5 layouts:** cose, circle, concentric, breadthfirst, grid

**Estilos de arista por tipo:**
- Amistad recíproca: azul sólido, grosor 3
- Amistad unilateral: azul claro, flecha
- Trabajo: verde, guiones
- Emocional: violeta, puntos
- Negativa: rojo claro, guiones

**Bordes de nodo:** aislado=rojo sólido, vulnerable=naranja guiones, líder=amarillo grueso, puente=índigo

**Tooltip hover** con datos completos del alumno

**Exportación PNG:** `exportPNG()` vía `forwardRef` + `useImperativeHandle`

### Página de sociograma

**Archivo:** `src/app/(dashboard)/processes/[id]/sociogram/page.tsx` (reescrito)

**Toolbar:**
- Selector de layout
- Selector de colorBy
- Filtro por clase
- Chips: mostrar solo aislados, solo recíprocos, por tipo de relación
- Botones: Exportar PNG, Exportar Excel

**Panel derecho con 4 pestañas:**
1. **Métricas** — tarjetas (total, aislados, vulnerables, líderes, puentes, comunidades) + barras densidad/cohesión
2. **Alertas** — lista con severidad (alta/media/baja) codificada por color
3. **Grupos** — lista de comunidades con tamaño e indicador de subgrupo cerrado
4. **Alumnos** — tabla ordenada por centralidad con badges de tipo

### Exportación Excel del sociograma

**Archivo:** `src/lib/excel/export.ts` — `exportSociogramToExcel()`

**4 hojas:** Alumnos (métricas individuales), Comunidades, Alertas, Resumen global

**Endpoint:** `src/app/api/processes/[id]/sociogram/export/route.ts`

---

## FASE 3 — Algoritmo avanzado ✅

### Perfiles y pesos configurables

**Archivo:** `src/lib/algorithm/weights.ts`

**4 perfiles predefinidos:**

| Factor | Equilibrado | Social | Académico | Convivencia |
|---|---:|---:|---:|---:|
| Separaciones obligatorias | 100 | 100 | 80 | 100 |
| Evitar aislamiento | 95 | 100 | 65 | 75 |
| Amistades recíprocas | 90 | 100 | 55 | 65 |
| Amistades elegidas | 85 | 95 | 45 | 60 |
| Relaciones de trabajo | 75 | 85 | 70 | 60 |
| Equilibrio académico | 80 | 40 | 100 | 70 |
| Equilibrio de género | 60 | 35 | 80 | 60 |
| Mezcla de grupos | 50 | 25 | 60 | 50 |
| Conducta | 70 | 55 | 75 | 100 |
| Necesidades educativas | 80 | 65 | 90 | 85 |

Perfil `personalizado` activado automáticamente al modificar cualquier slider.

### Simulación de sociograma futuro

**Archivo:** `src/lib/algorithm/simulation.ts`

**Función:** `simulateFutureSociogram(assignments, responses) → ClassFutureMetrics[]`

**Métricas por clase destino:**
- Total de alumnos
- Alumnos con al menos un amigo en la misma clase
- Alumnos sin amigo (aislados en la nueva distribución)
- Pares recíprocos preservados en la clase
- Porcentaje de preservación de amistades recíprocas globales

### Heurístico avanzado

**Archivo:** `src/lib/algorithm/heuristic.ts` (reescrito completo)

**Nuevas funciones:**
- `checkInfeasibility()` — detecta reglas incompatibles antes de ejecutar
- `computeSubScores()` — calcula las 10 dimensiones por separado
- `computeScore()` — scoring rápido para la búsqueda local
- `buildResult()` — resultado completo con métricas y sociograma futuro

**Todos los tipos de regla soportados:**

| Tipo | Comportamiento |
|---|---|
| `must_separate` | Separación obligatoria, penaliza si se viola |
| `lock_student_to_class` | Asignación fija a clase destino |
| `exclude_student` | Excluye alumno del proceso |
| `must_keep_together` | Asigna grupo completo a la misma clase |
| `should_keep_together` | Intenta mantener juntos (regla blanda, se omite en algunos seeds) |
| `keep_at_least_one` | Búsqueda local: garantiza que el alumno tenga al menos un amigo de la lista |
| `max_from_group` | Limita cuántos alumnos del grupo van a cada clase |
| `protect_vulnerable` | Igual que `keep_at_least_one` para alumnos con una sola conexión |

**Proceso de generación:**
1. Asignar alumnos bloqueados (`lock_student_to_class`)
2. Asignar grupos `must_keep_together` vinculados a un bloqueado
3. Construir unidades de distribución (grupos + individuales)
4. Distribución snake desde la clase menos cargada
5. Verificar `must_separate` y `max_from_group` en cada asignación
6. Búsqueda local para `keep_at_least_one` y `protect_vulnerable`
7. Búsqueda local por swap aleatorio (hasta 300 iteraciones, acepta si mejora score)
8. Deduplicación por fingerprint
9. Hasta 10 propuestas, ordenadas por `score_total` descendente

**Detección de infactibilidad:**
- Dos alumnos que deben separarse pero están ambos bloqueados en la misma clase
- Grupo `must_keep_together` con miembros bloqueados en clases distintas
- Sin clases destino configuradas
- Menos alumnos que clases destino

### Página de configuración del algoritmo

**Archivo:** `src/app/(dashboard)/processes/[id]/algorithm/page.tsx`

**Secciones:**
1. Selector de perfil (4 tarjetas con icono y descripción)
2. Sliders de pesos individuales (0–100, paso 5) — 10 dimensiones
3. Slider de número de propuestas (1–10)
4. Botón "Ejecutar algoritmo" → genera y redirige a propuestas
5. Panel de infactibilidad con explicación detallada si hay reglas incompatibles

### API de generación actualizada

**Archivo:** `src/app/api/processes/[id]/proposals/generate/route.ts`

**Body POST opcional:**
```json
{
  "weights": { "conflicts": 100, "avoid_isolation": 95, ... },
  "num_proposals": 5
}
```

Devuelve `{ error, infeasibility }` con explicación si hay reglas incompatibles.

### Página de propuestas con comparador

**Archivo:** `src/app/(dashboard)/processes/[id]/proposals/page.tsx` (reescrito)

**Tabla comparativa** (visible si hay > 1 propuesta):
- Puntuación total, social, académica, género, convivencia
- Alumnos con amigo (% y absoluto)
- Pares recíprocos preservados
- La mejor columna marcada con ★ en verde

**Tarjetas de propuesta:**
- Barras de puntuación por dimensión
- Chips resumen: alumnos por clase, con amigo, sin amigo
- Vista expandida por clase con métricas detalladas:
  - Nota media, distribución F/M
  - Alumnos con amigo / sin amigo en la clase
  - Pares recíprocos en la clase
  - Alumnos con seguimiento / necesidades educativas
  - Lista de alumnos (nombre + clase de origen)

**Acciones:** Exportar Excel, Aprobar (con confirmación), Regenerar → redirige a /algorithm

### Componentes nuevos

**Archivo:** `src/components/ui/slider.tsx`
- Slider nativo (`input[type=range]`) con overlay visual Tailwind
- API compatible: `value: [number]`, `onValueChange: ([number]) => void`

### Sidebar actualizado

**Archivo:** `src/components/layout/sidebar.tsx`

Nuevo enlace "Algoritmo" (icono Zap) entre Reglas y Propuestas en la navegación de proceso.

---

## FASE 4 — Edición manual e informes ✅

### Editor drag & drop

**Archivo:** `src/app/(dashboard)/processes/[id]/proposals/[proposalId]/edit/page.tsx`

**Layout:**
- Barra superior con nombre de propuesta, botón guardar, contador de conflictos, badge "Sin guardar"
- Panel kanban: columna por clase destino, tarjetas de alumnos
- Panel lateral de impacto

**Tarjetas de alumno:**
- Nombre, clase de origen, nota media
- Indicadores: ⚠ (seguimiento), NEE (necesidades educativas)
- Icono de candado (bloquear/desbloquear posición)
- `draggable` — arrastra a otra columna para mover
- Alumnos bloqueados: gris, sin arrastrar

**Panel de impacto (tiempo real):**
- Último movimiento realizado
- Conflictos de reglas activos (must_separate violadas)
- Por cada clase: alumnos, nota media, distribución F/M, con amigo/sin amigo, seguimiento, NEE

**Métricas calculadas en cliente:**
- `computeClassStats()` — cálculo sin llamadas al servidor
- `findViolations()` — verificación instantánea de reglas de separación

**Guardar cambios:** `PATCH /api/proposals/[id]/assignments` — reemplaza assignments, marca `status: "editada"`

### Informe imprimible (PDF)

**Archivo:** `src/app/(dashboard)/processes/[id]/proposals/[proposalId]/report/page.tsx`

Página servidor que renderiza sin necesidad de JS en el cliente.

**Secciones:**
1. Cabecera con nombre del proceso, nivel, curso, fecha
2. **Resumen ejecutivo** — tabla comparativa de todas las clases con: alumnos, género, nota media, con amigo %, NEE, seguimiento + puntuaciones
3. **Distribución por clase** — tabla detallada por clase con: nº, apellidos+nombre, clase origen, género, nota, nivel académico, necesidades, observaciones
4. Pie de página con aviso RGPD

**Comportamiento print:**
- Barra de herramientas con botón "Imprimir / Guardar PDF" oculta al imprimir (`print:hidden`)
- Sidebar oculto al imprimir (`print:hidden` en `<aside>`)
- Tablas con bordes y colores zebra limpios para papel
- Alumnos con seguimiento: fondo naranja suave
- Saltos de página inteligentes (`break-inside-avoid` por sección)

**Botón de impresión:** `PrintButton.tsx` (client component separado, llama `window.print()`)

### Nuevas API routes

| Ruta | Método | Descripción |
|---|---|---|
| `/api/proposals/[id]` | GET | Detalle de propuesta con assignments + metrics |
| `/api/proposals/[id]/assignments` | PATCH | Actualiza asignaciones y marca como editada |
| `/api/processes/[id]/responses` | GET | Lista de respuestas sociométricas del proceso |

### Páginas actualizadas

**`proposals/page.tsx`** — Nuevos botones por propuesta:
- **Informe** → abre `/proposals/[id]/report` en nueva pestaña
- **Editar** → navega a `/proposals/[id]/edit`

**`processes/[id]/page.tsx`** — Nueva sección "Algoritmo" en el panel de acceso rápido

**`sidebar.tsx`** — `print:hidden` en `<aside>` (el sidebar desaparece al imprimir)

---

## FASE 5 — Producto completo SaaS ✅

- [x] Superadmin: gestión de centros y licencias (panel `/admin`)
- [x] Dashboard mejorado con stats reales y actividad reciente
- [x] Sidebar role-based (muestra/oculta secciones según rol)
- [x] Panel de auditoría `/audit` con filtros y paginación
- [x] Gestión de usuarios `/users` (cambiar rol, eliminar)
- [x] API `GET/PATCH/DELETE /api/users` y `/api/users/[id]`
- [x] Panel superadmin `/admin` — CRUD de centros
- [x] API `GET/POST /api/admin/centers` y `PATCH/DELETE /api/admin/centers/[id]`
- [x] Configuración del centro `/settings` — editar nombre, dirección, ciudad
- [x] Aislamiento total de datos por `center_id` (RLS estricto) — migración 003
- [ ] Límites por licencia: nº procesos, nº alumnos, módulos activos
- [x] Tutor ve solo sus grupos asignados (via `process_tutors`)
- [ ] Orientador con acceso a datos sensibles + registro obligatorio
- [ ] Históricos inter-anuales: comparar sociogramas de distintos cursos
- [ ] IA explicativa: resúmenes automáticos de alertas y propuestas
- [ ] OAuth Google Workspace + Microsoft 365

### Ficheros clave de Fase 5

| Fichero | Descripción |
|---|---|
| `src/app/(dashboard)/dashboard/page.tsx` | Dashboard con stats reales, feed de actividad, accesos rápidos |
| `src/app/(dashboard)/audit/page.tsx` | Registro de acciones con filtro por tipo y paginación |
| `src/app/(dashboard)/users/page.tsx` | Listado de usuarios + `UserActions.tsx` (cambio de rol, eliminación) |
| `src/app/(dashboard)/settings/page.tsx` | Formulario de edición del centro (client component) |
| `src/app/(dashboard)/admin/page.tsx` | Gestión de centros para superadmin (CRUD) |
| `src/app/api/users/route.ts` | GET — lista usuarios del centro |
| `src/app/api/users/[id]/route.ts` | PATCH — cambiar rol · DELETE — eliminar usuario |
| `src/app/api/admin/centers/route.ts` | GET — todos los centros · POST — crear centro |
| `src/app/api/admin/centers/[id]/route.ts` | PATCH — editar · DELETE — eliminar centro |
| `src/components/layout/sidebar.tsx` | Añadido `userRole` prop + items condicionales (Usuarios, Auditoría, Configuración, Super Admin) |

---

## FASE 6 — Seguridad, flujo de trabajo y roles avanzados ✅

### Migraciones SQL

| Fichero | Descripción |
|---|---|
| `supabase/migrations/002_process_tutors.sql` | Tabla `process_tutors` (process_id, user_id, assigned_by) con índices y unique constraint |
| `supabase/migrations/003_rls_policies.sql` | RLS completo en todas las tablas: funciones helper `current_center_id()`, `is_superadmin()`, `is_admin_or_superadmin()` |

### Transiciones de estado del proceso

`ProcessActions.tsx` (client component en `/processes/[id]/`) — muestra los botones de avance según el estado actual:

```
borrador → Abrir cuestionario
cuestionario_abierto → Cerrar cuestionario
cuestionario_cerrado → Iniciar análisis
propuesta_seleccionada → Cerrar proceso
cerrado → Archivar
cualquier estado → Archivar (ghost) + Eliminar (destructive, solo admins)
```

Llama a `PATCH /api/processes/[id]` con `{ status }`. Eliminar usa `DELETE /api/processes/[id]` y redirige a `/processes`.

### Asignación de tutores

`ProcessTeam.tsx` (client component en `/processes/[id]/`) — muestra el equipo asignado al proceso con opciones de añadir/quitar (solo admins). Carga usuarios del centro via `GET /api/users`.

| Ruta | Método | Descripción |
|---|---|---|
| `/api/processes/[id]/tutors` | GET | Lista asignaciones con datos del usuario |
| `/api/processes/[id]/tutors` | POST | Asigna usuario al proceso (valida mismo centro) |
| `/api/processes/[id]/tutors/[userId]` | DELETE | Desasigna usuario |

### Filtrado por rol en lista de procesos

`/processes/page.tsx` — si el usuario es tutor u orientador, consulta `process_tutors` para obtener solo sus `process_id` y filtra la lista. Admins ven todos. El botón "Nuevo proceso" solo se muestra a admins.

### Sidebar móvil

Reescritura de `sidebar.tsx`:
- `SidebarContent` como función interna reutilizable (recibe `onNavigate?` para cerrar el drawer)
- `NavLink` como componente auxiliar para evitar duplicación
- Desktop: `hidden lg:flex` (barra fija)
- Mobile: botón hamburguesa `fixed top-4 left-4` + drawer `fixed` con `translate-x-0/-translate-x-full` + overlay `bg-black/40`

### Ficheros clave de Fase 6

| Fichero | Descripción |
|---|---|
| `supabase/migrations/002_process_tutors.sql` | Nueva tabla `process_tutors` |
| `supabase/migrations/003_rls_policies.sql` | RLS completo multi-tenant |
| `src/app/(dashboard)/processes/[id]/ProcessActions.tsx` | Botones de transición de estado + archivar + eliminar |
| `src/app/(dashboard)/processes/[id]/ProcessTeam.tsx` | UI de asignación de tutores al proceso |
| `src/app/(dashboard)/processes/[id]/page.tsx` | Reescrito: incluye ProcessActions, ProcessTeam, fechas, % cuestionario |
| `src/app/(dashboard)/processes/page.tsx` | Filtrado por rol: tutores ven solo sus procesos asignados |
| `src/app/api/processes/[id]/route.ts` | Añadido DELETE |
| `src/app/api/processes/[id]/tutors/route.ts` | GET + POST asignaciones |
| `src/app/api/processes/[id]/tutors/[userId]/route.ts` | DELETE asignación |
| `src/components/layout/sidebar.tsx` | Reescrito con soporte móvil (drawer) y NavLink reutilizable |

---

## FASE 7 — Autenticación OAuth y control de acceso por rol ✅

### OAuth Google + Microsoft

**Archivo:** `src/app/(auth)/login/page.tsx`

- Botones Google y Microsoft con iconos SVG inline
- `supabase.auth.signInWithOAuth({ provider, redirectTo: '/api/auth/callback' })`
- Estado `oauthLoading` por proveedor; ambos botones se deshabilitan durante el flujo
- Provider de Microsoft: `'azure'` (nombre que usa Supabase para Microsoft Entra/Azure AD)

**Configuración necesaria en Supabase Dashboard:**
- Authentication → Providers → Google: activar, añadir Client ID y Secret de Google Cloud Console
- Authentication → Providers → Azure: activar, añadir Client ID y Secret de Microsoft Entra
- En ambos: añadir `https://<proyecto>.supabase.co/auth/v1/callback` como Redirect URI

### Página de cuenta pendiente

**Archivo:** `src/app/pending/page.tsx`

- Página standalone (sin dashboard layout), accesible sin autenticación
- Se muestra cuando un usuario OAuth inicia sesión por primera vez pero no tiene perfil en la tabla `users`
- Muestra instrucciones para contactar con el admin del centro
- Botón de logout vía `supabase.auth.signOut()`

### Auth callback actualizado

**Archivo:** `src/app/api/auth/callback/route.ts`

- Tras `exchangeCodeForSession`, consulta `users` table por `id = user.id`
- Si no existe perfil → `redirect('/pending')`
- Si existe → `redirect(next)` (por defecto `/dashboard`)

**Flujo completo OAuth:**
```
Login → Google/Microsoft → Supabase OAuth → /api/auth/callback
  → perfil existe? → /dashboard
  → perfil no existe? → /pending (con instrucciones para admin)
```

### Middleware

**Archivo:** `src/middleware.ts`

`/pending` añadida a `PUBLIC_ROUTES` para que usuarios autenticados sin perfil no queden en bucle de redirección.

### Control de acceso en sociograma

**Archivo:** `src/app/api/processes/[id]/sociogram/route.ts`

**Filtrado por rol:**
- `admin`, `superadmin`, `orientador` → ven todas las respuestas (amistad, trabajo, emocional, negativa)
- `tutor` → solo ven amistad y trabajo (emocional y negativa filtradas en servidor)

**Audit logging automático:**
- Cuando un `orientador` consulta el sociograma, se registra automáticamente en `audit_logs` con acción `view_sociogram`

**Respuesta enriquecida:**
```json
{
  ...sociogramData,
  "viewer_role": "orientador",
  "can_see_sensitive": true
}
```

**Archivo:** `src/app/(dashboard)/processes/[id]/sociogram/page.tsx`

Dos banners condicionales según el rol devuelto por la API:
- **Orientador** → banner ámbar: "Tu acceso a este sociograma queda registrado. Los datos mostrados son confidenciales."
- **Tutor** → banner azul: "Vista limitada: las relaciones emocionales y negativas solo son visibles para orientación."

### Ficheros clave de Fase 7

| Fichero | Descripción |
|---|---|
| `src/app/(auth)/login/page.tsx` | Botones OAuth Google + Microsoft |
| `src/app/pending/page.tsx` | Página para usuarios OAuth sin perfil asignado |
| `src/app/api/auth/callback/route.ts` | Redirige a /pending si no hay perfil |
| `src/middleware.ts` | /pending añadida a rutas públicas |
| `src/app/api/processes/[id]/sociogram/route.ts` | Filtrado por rol + audit log orientador |
| `src/app/(dashboard)/processes/[id]/sociogram/page.tsx` | Banners de aviso por rol |

---

## FASE 8 — Licencias, históricos e IA explicativa ✅

### Sistema de licencias

- **`supabase/migrations/004_licenses.sql`**: tabla `licenses` con campos `plan`, `max_processes`, `max_students`, `max_users`, `valid_until`. RLS con helpers de fases anteriores. Default `free` para centros existentes.
- **`src/lib/license.ts`**: `getCenterLicense()`, `PLAN_LIMITS`, `PLAN_LABELS`, `isExpired()`.
- **`GET /api/license`**: devuelve licencia del centro + contadores de uso (`used_processes`, `used_users`).
- **`GET/PUT /api/admin/licenses/[centerId]`**: superadmin consulta y actualiza licencia de cualquier centro.
- **Enforcement**: `POST /api/processes` verifica `max_processes` antes de crear; devuelve 403 con mensaje explicativo si se supera el límite.
- **Dashboard**: banner de advertencia cuando se alcanza el límite de procesos activos del plan.
- **Admin panel**: cada centro muestra su plan como badge clickable; inline editor con Select de plan + botones guardar/cancelar.

Planes:

| Plan | Procesos | Alumnos/proceso | Usuarios |
|---|---|---|---|
| free | 1 | 60 | 3 |
| basic | 5 | 120 | 10 |
| pro | 20 | 200 | 50 |
| enterprise | ilimitado | ilimitado | ilimitado |

### Históricos inter-anuales

- **`GET /api/history`**: agrega datos de todos los procesos del centro. Para cada proceso calcula: `total_students`, `total_responses`, `tokens_total/completed`, `response_rate`, `sociogram_isolated/vulnerable` y porcentajes.
- **`/history`** (client component): agrupa procesos por `school_year`, muestra tabla de tendencias cross-year y cards individuales por proceso con indicadores de color (verde/amarillo/rojo según umbrales). `TrendBadge` con flechas de tendencia.

### IA explicativa (Claude API)

- **`src/lib/ai.ts`**: wrapper `generateAISummary(prompt)` usando `fetch` directo a `api.anthropic.com/v1/messages` con modelo `claude-haiku-4-5-20251001`. No requiere SDK instalado.
- **`POST /api/processes/[id]/sociogram/explain`**: genera informe orientador del sociograma (aislados, vulnerables, centralidad media). Solo accesible para admin/superadmin/orientador.
- **`POST /api/proposals/[id]/explain`**: genera resumen ejecutivo de una propuesta con puntuaciones + métricas por clase. Solo admin/superadmin.
- **Fallback**: si `ANTHROPIC_API_KEY` no está configurada devuelve 503 con mensaje amigable.
- **UI sociograma**: botón "Análisis IA" en toolbar (visible para admin/orientador). Respuesta en panel violet expandible con botón cerrar.
- **UI propuestas**: botón sparkles por cada propuesta. Resumen aparece como card violet encima de las score bars. Botón cerrar individual.
- **Sidebar**: nuevo link "Histórico" con icono `BarChart3`.

### Variables de entorno añadidas

```
ANTHROPIC_API_KEY=<tu-api-key>   # Opcional — la IA no estará disponible sin esto
```

---

## Decisiones técnicas relevantes

### Supabase y tipos
- Las relaciones embebidas (`select("*, tabla(*)")`) devuelven `never` sin `Relationships` en el tipo generado → cast a `any` necesario con comentario eslint-disable
- `Buffer` no es `BodyInit` en TypeScript → usar `buffer as unknown as BodyInit`
- El tipo `Json` de Supabase requiere cast explícito para `Record<string, unknown>`

### Cytoscape.js en Next.js
- Requiere `dynamic import` con `ssr: false` o carga asíncrona dentro de `useEffect`
- El componente usa `forwardRef` + `useImperativeHandle` para exponer `exportPNG()`

### Algoritmo
- La búsqueda local por swap usa scoring rápido (`computeScore`) en el bucle interno y scoring completo (`buildResult`) solo una vez al finalizar, para rendimiento
- El seed `0` usa distribución determinista por nota; seeds > 0 aleatorizan para variedad
- La deduplicación por fingerprint evita propuestas idénticas sin importar el orden de iteración
