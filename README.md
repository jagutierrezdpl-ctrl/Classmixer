# ClassMixer

Plataforma web para centros educativos que combina análisis sociométrico, datos académicos y criterios docentes para generar distribuciones equilibradas de clases. El algoritmo propone, el docente decide.

---

## Qué hace

1. **Importa alumnos** desde Excel con validación automática de datos
2. **Lanza un cuestionario sociométrico** accesible por enlace o código individual
3. **Genera sociogramas interactivos** con detección de alumnos aislados, líderes, subgrupos y alumnos puente
4. **Ejecuta un algoritmo de mezcla** configurable con pesos por criterio (académico, social, convivencia...)
5. **Genera propuestas comparables** con métricas detalladas y sociograma futuro simulado
6. **Permite edición manual** mediante drag & drop con impacto en tiempo real
7. **Exporta** a Excel y a informe imprimible (PDF desde el navegador)

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Framework | Next.js 15 (App Router) |
| Lenguaje | TypeScript |
| Estilos | Tailwind CSS v4 |
| Componentes UI | shadcn/ui |
| Grafos | Cytoscape.js |
| Base de datos | Supabase (PostgreSQL) |
| Autenticación | Supabase Auth |
| Formularios | React Hook Form + Zod |
| Excel | xlsx |
| Algoritmo | Heurística propia (snake distribution + búsqueda local por swaps) |

---

## Puesta en marcha

### Requisitos

- Node.js 18+
- Cuenta en [Supabase](https://supabase.com) con un proyecto creado

### Variables de entorno

Crea un archivo `.env.local` en la raíz con:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<tu-proyecto>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<tu-anon-key>
```

### Instalar y ejecutar

```bash
npm install
npm run dev
```

La aplicación estará disponible en `http://localhost:3000`.

### Base de datos

Las migraciones SQL deben ejecutarse en el editor SQL de Supabase. Las tablas necesarias son (en orden de dependencia):

```
centers → users → processes → students
→ questionnaire_settings → questionnaire_tokens
→ responses → rules → rule_students
→ proposals → proposal_assignments → proposal_metrics
→ sociogram_metrics → audit_logs
```

Consulta el archivo `CLAUDE.md` para el esquema completo de cada tabla.

---

## Estructura del proyecto

```
src/
├── app/
│   ├── (auth)/              # Login
│   ├── (dashboard)/         # Área privada admin
│   │   ├── dashboard/
│   │   ├── processes/
│   │   │   ├── [id]/
│   │   │   │   ├── students/        # Importación y listado de alumnos
│   │   │   │   ├── questionnaire/   # Configuración y seguimiento
│   │   │   │   ├── sociogram/       # Visualización interactiva
│   │   │   │   ├── rules/           # Reglas pedagógicas
│   │   │   │   ├── algorithm/       # Configuración del algoritmo
│   │   │   │   └── proposals/
│   │   │   │       ├── page.tsx              # Comparador de propuestas
│   │   │   │       └── [proposalId]/
│   │   │   │           ├── edit/    # Editor drag & drop
│   │   │   │           └── report/  # Informe imprimible
│   ├── q/[token]/           # Cuestionario público (alumnos)
│   └── api/                 # API Routes
├── components/
│   ├── ui/                  # shadcn/ui base
│   ├── sociogram/           # SociogramGraph (Cytoscape.js)
│   └── layout/              # Sidebar, layout
├── lib/
│   ├── algorithm/
│   │   ├── heuristic.ts     # Generador de propuestas
│   │   ├── simulation.ts    # Sociograma futuro
│   │   └── weights.ts       # Perfiles de configuración
│   ├── sociogram/
│   │   └── calculate.ts     # Betweenness, comunidades, alertas
│   ├── excel/
│   │   ├── import.ts        # Parser y validación de Excel
│   │   └── export.ts        # Exportación a Excel
│   ├── supabase/            # Clientes servidor/cliente
│   └── auth.ts              # Perfil, roles, audit log
├── types/                   # Tipos TypeScript globales
└── schemas/                 # Validaciones Zod
```

---

## Flujo de uso

```
Crear proceso
    ↓
Importar alumnos (Excel)
    ↓
Configurar cuestionario → Generar enlace / QR
    ↓
Alumnos responden en /q/[token]
    ↓
Ver sociograma (aislados, líderes, subgrupos, puentes)
    ↓
Definir reglas (separar, mantener juntos, bloquear...)
    ↓
Configurar algoritmo (perfil + pesos)
    ↓
Generar propuestas (hasta 10)
    ↓
Comparar propuestas → Editar manualmente (drag & drop)
    ↓
Aprobar → Exportar Excel / Imprimir informe PDF
```

---

## Roles de usuario

| Rol | Permisos |
|---|---|
| `superadmin` | Gestión de centros y licencias |
| `admin` | Acceso completo al proceso (crear, importar, generar, aprobar) |
| `tutor` | Ver alumnos de sus grupos, añadir observaciones y reglas |
| `orientador` | Acceso a datos sociales sensibles, sociogramas, alertas |
| `alumno` | Solo accede al cuestionario mediante enlace |

---

## Algoritmo de mezcla

El algoritmo no usa solvers externos (OR-Tools queda para fases futuras). Implementa:

1. **Distribución snake** — ordena por nota media, asigna en zig-zag entre clases para equilibrar
2. **Respeto de reglas duras** — `must_separate`, `lock_student_to_class`, `exclude_student`, `must_keep_together`, `max_from_group`
3. **Búsqueda local para reglas blandas** — `keep_at_least_one`, `protect_vulnerable`, `should_keep_together`
4. **Búsqueda local por swaps** — hasta 300 iteraciones de intercambio aleatorio, acepta si mejora la puntuación
5. **Multi-propuesta** — hasta 10 propuestas con seeds distintos, deduplicadas por fingerprint

### Dimensiones de scoring

Cada propuesta se puntúa 0–100 en 10 dimensiones, ponderadas por los pesos configurados:

| Dimensión | Qué mide |
|---|---|
| `conflicts` | Penaliza violaciones de separaciones obligatorias |
| `avoid_isolation` | % de alumnos con al menos un amigo en su clase |
| `reciprocal_friendships` | % de pares recíprocos preservados |
| `chosen_friendships` | % de elecciones de amistad preservadas |
| `work_relations` | % de relaciones de trabajo preservadas |
| `academic_balance` | Inverso de la varianza de nota media entre clases |
| `gender_balance` | Equilibrio del ratio F/M entre clases |
| `group_mix` | Dispersión de los grupos de origen entre clases |
| `behavior` | Distribución uniforme de alumnos con seguimiento |
| `special_needs` | Distribución uniforme de necesidades educativas |

### Perfiles predefinidos

- **Equilibrado** — peso similar en todos los factores
- **Social** — prioriza amistades y evita aislamiento
- **Académico** — maximiza equilibrio de notas y niveles
- **Convivencia** — enfocado en separar conflictos y distribuir conducta

---

## Sociograma

Visualización interactiva con Cytoscape.js.

### Métricas calculadas

- Elecciones dadas / recibidas por alumno
- Relaciones recíprocas
- **Centralidad de grado** normalizada
- **Betweenness centrality** (algoritmo de Brandes, O(N·E))
- **Comunidades** detectadas por Union-Find sobre pares recíprocos

### Detecciones automáticas

| Tipo | Criterio |
|---|---|
| Aislado | 0 elecciones recibidas |
| Vulnerable | Solo 1 relación recíproca |
| Líder | Elecciones recibidas > media + 1.5σ |
| Puente | Betweenness > 15% del máximo Y conecta ≥ 2 comunidades |
| Subgrupo cerrado | Comunidad ≥ 3 miembros con < 50% de conexiones externas |

### Modos de visualización

- Color por: clase de origen, género, nivel académico, comunidad, conducta, riesgo social
- Layouts: cose, circle, concentric, breadthfirst, grid
- Filtros: por clase, solo aislados, solo recíprocos, por tipo de relación
- Exportación: PNG (alta resolución) y Excel con métricas individuales

---

## Tipos de reglas

| Tipo | Comportamiento |
|---|---|
| `must_separate` | Separación obligatoria entre alumnos |
| `must_keep_together` | Grupo que debe ir junto |
| `should_keep_together` | Preferiblemente juntos (regla blanda) |
| `keep_at_least_one` | El alumno debe tener al menos uno de la lista |
| `max_from_group` | Máximo N alumnos del grupo en cada clase |
| `lock_student_to_class` | Asignación fija a una clase destino |
| `exclude_student` | Excluir del proceso (repite, cambia de centro...) |
| `protect_vulnerable` | Garantiza que el alumno conserve su única conexión |

---

## Exportaciones

| Tipo | Formato | Contenido |
|---|---|---|
| Propuesta final | Excel (.xlsx) | Una hoja por clase + hoja resumen |
| Sociograma | Excel (.xlsx) | Métricas individuales, comunidades, alertas, resumen |
| Informe completo | HTML imprimible → PDF | Resumen ejecutivo + distribución por clase |

---

## Estado del desarrollo

| Fase | Estado |
|---|---|
| Fase 1 — MVP funcional | ✅ Completo |
| Fase 2 — Sociograma avanzado | ✅ Completo |
| Fase 3 — Algoritmo avanzado | ✅ Completo |
| Fase 4 — Edición manual e informes | ✅ Completo |
| Fase 5 — Producto completo SaaS | ✅ Completo |
| Fase 6 — Seguridad, flujo de trabajo y roles | ✅ Completo |

Ver `PROGRESS.md` para el detalle técnico completo de cada fase.

---

## Privacidad y RGPD

- Los alumnos solo acceden a su cuestionario; no ven datos de otros
- El sociograma solo es accesible para personal autorizado
- Toda acción sensible queda registrada en `audit_logs`
- Los procesos pueden archivarse y borrarse completamente
- Acceso restringido por `center_id` (Row Level Security en Supabase)

---

## Licencia

Proyecto privado. Todos los derechos reservados.
