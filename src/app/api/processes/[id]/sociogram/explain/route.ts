import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, logAudit } from "@/lib/auth"
import { generateAISummary } from "@/lib/ai"
import { NextResponse } from "next/server"
import { calculateSociogram } from "@/lib/sociogram/calculate"
import { getQuestionCatalogIndex } from "@/lib/questionnaire/catalog"
import { filterVisibleResponses } from "@/lib/questionnaire/visibility"
import type { UserRole } from "@/types"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (!["admin", "superadmin", "orientador"].includes(profile.role)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 })
  }

  const { id } = await params
  const supabase = createServiceClient()

  const [{ data: proc }, { data: center }, { data: allStudents }, { data: allResponses }] = await Promise.all([
    supabase.from("processes").select("name, school_year, center_id").eq("id", id).single(),
    supabase.from("centers").select("openrouter_api_key").eq("id", profile.center_id).single(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from("students").select("*").eq("process_id", id).eq("active", true),
    supabase.from("responses").select("*").eq("process_id", id),
  ])

  if (!proc || proc.center_id !== profile.center_id) {
    return NextResponse.json({ error: "Proceso no encontrado" }, { status: 404 })
  }

  if (!allStudents || allStudents.length === 0) {
    return NextResponse.json({ error: "No hay alumnos en este proceso" }, { status: 400 })
  }

  if (!allResponses || allResponses.length === 0) {
    return NextResponse.json({
      summary: "No hay respuestas al cuestionario sociométrico todavía. Para obtener un análisis, los alumnos deben completar el cuestionario primero.",
    })
  }

  // Log access for orientadores
  if (profile.role === "orientador") {
    await logAudit(profile.id, profile.center_id, "view_sociogram_ai", "process", {
      processId: id,
      metadata: { role: profile.role },
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const students = (allStudents as any[]).filter((s: any) => !s.excluded_from_mix)
  const catalogIndex = await getQuestionCatalogIndex(profile.center_id)
  const responses = filterVisibleResponses(
    allResponses ?? [],
    profile.role as UserRole,
    catalogIndex.sensitivity
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sg = calculateSociogram(students as any, responses as any, catalogIndex.scoringRoles.friendshipLike, catalogIndex.excludedFromGraph)

  const total = sg.nodes.length
  if (total === 0) {
    return NextResponse.json({ summary: "No hay datos suficientes para generar un análisis." })
  }

  // Compute aggregates
  const isolated = sg.nodes.filter(n => n.is_isolated)
  const vulnerable = sg.nodes.filter(n => n.is_vulnerable && !n.is_isolated)
  const leaders = sg.nodes.filter(n => n.is_leader)
  const bridges = sg.nodes.filter(n => n.is_bridge)
  const avgReceived = (sg.nodes.reduce((s, n) => s + n.received_count, 0) / total).toFixed(1)
  const avgReciprocal = (sg.nodes.reduce((s, n) => s + n.reciprocal_count, 0) / total).toFixed(1)
  const reciprocalPairs = sg.metrics.reciprocal_pairs
  const communityCount = sg.communities.length
  const closedGroups = sg.communities.filter(c => c.is_closed)

  // Top elected students
  const topElected = [...sg.nodes]
    .sort((a, b) => b.received_count - a.received_count)
    .slice(0, 5)
    .map(n => `${n.first_name} ${n.last_name} (${n.received_count} elecciones)`)

  // Compose detailed prompt
  const isolatedNames = isolated.map(n => `${n.first_name} ${n.last_name}`).join(", ") || "ninguno"
  const vulnerableNames = vulnerable.slice(0, 5).map(n => `${n.first_name} ${n.last_name}`).join(", ") || "ninguno"
  const leaderNames = leaders.slice(0, 5).map(n => `${n.first_name} ${n.last_name} (${n.received_count})`).join(", ") || "ninguno"
  const bridgeNames = bridges.slice(0, 4).map(n => `${n.first_name} ${n.last_name}`).join(", ") || "ninguno"
  const alertSummary = sg.alerts.map(a => `[${a.severity.toUpperCase()}] ${a.message}`).join("\n") || "Sin alertas"

  const prompt = `Eres un orientador escolar experto en análisis sociométrico. Analiza estos datos reales del sociograma del proceso "${proc.name}" (${proc.school_year}) y redacta un informe profesional en español para el equipo docente.

DATOS DEL GRUPO (${total} alumnos):

Métricas globales:
- Alumnos analizados: ${total}
- Respuestas recibidas del cuestionario: ${responses.length}
- Media de elecciones recibidas por alumno: ${avgReceived}
- Media de relaciones recíprocas por alumno: ${avgReciprocal}
- Total de pares con amistad recíproca: ${reciprocalPairs}
- Densidad de red: ${(sg.metrics.density * 100).toFixed(1)}%
- Cohesión del grupo: ${(sg.metrics.cohesion * 100).toFixed(1)}%
- Comunidades/subgrupos detectados: ${communityCount}

Alumnos en riesgo:
- Aislados (0 elecciones recibidas): ${isolated.length} — ${isolatedNames}
- Vulnerables (solo 1 relación recíproca): ${vulnerable.length} — ${vulnerableNames}

Líderes sociales (más elegidos):
- ${leaderNames}

Más votados en general: ${topElected.join(", ")}

Alumnos puente (conectan distintos grupos): ${bridgeNames}

Subgrupos detectados: ${communityCount}${closedGroups.length > 0 ? ` (${closedGroups.length} cerrado${closedGroups.length !== 1 ? "s" : ""}, tamaños: ${closedGroups.map(c => c.size).join(", ")})` : ""}

Alertas automáticas del sistema:
${alertSummary}

Redacta el informe con estas tres secciones (máximo 300 palabras en total):
1. **Observaciones principales**: qué caracteriza la dinámica social de este grupo según los datos
2. **Puntos de atención**: qué situaciones concretas merecen seguimiento (menciona alumnos por nombre si procede)
3. **Recomendaciones**: acciones concretas para el momento de la mezcla de clases, especialmente para proteger a los alumnos más vulnerables

Tono: profesional, objetivo, orientado a la acción docente. No inventes datos que no estén arriba.`

  try {
    const summary = await generateAISummary(
      prompt,
      (center as { openrouter_api_key?: string | null } | null)?.openrouter_api_key
    )
    return NextResponse.json({ summary })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
