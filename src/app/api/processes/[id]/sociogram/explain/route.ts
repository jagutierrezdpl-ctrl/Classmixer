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

  const nodeMap = new Map(sg.nodes.map(n => [n.id, n]))

  // Isolated: find who (if anyone) chose them — so we can suggest keeping them together
  const isolatedDetail = sg.nodes
    .filter(n => n.is_isolated)
    .map(n => {
      const choosers = sg.edges
        .filter(e => e.target === n.id && e.relation_type === "friendship")
        .map(e => nodeMap.get(e.source)?.first_name)
        .filter(Boolean)
      const chose = sg.edges
        .filter(e => e.source === n.id && e.relation_type === "friendship")
        .map(e => nodeMap.get(e.target)?.first_name)
        .filter(Boolean)
      const parts = []
      if (choosers.length) parts.push(`le eligió: ${choosers.join(", ")}`)
      if (chose.length) parts.push(`eligió a: ${chose.join(", ")}`)
      return `• ${n.first_name} ${n.last_name}${parts.length ? ` (${parts.join("; ")})` : " (nadie le eligió ni él eligió a nadie)"}`
    })
    .join("\n")

  // Vulnerable: show their single reciprocal friend
  const vulnerableDetail = sg.nodes
    .filter(n => n.is_vulnerable && !n.is_isolated)
    .slice(0, 8)
    .map(n => {
      const reciprocal = sg.edges
        .filter(e => e.source === n.id && e.relation_type === "friendship")
        .filter(e => sg.edges.some(e2 => e2.source === e.target && e2.target === n.id && e2.relation_type === "friendship"))
        .map(e => nodeMap.get(e.target)?.first_name)
        .filter(Boolean)
      return `• ${n.first_name} ${n.last_name}${reciprocal.length ? ` (único vínculo: ${reciprocal.join(", ")})` : ""}`
    })
    .join("\n")

  const leaders = sg.nodes.filter(n => n.is_leader)
  const bridges = sg.nodes.filter(n => n.is_bridge)
  const closedGroups = sg.communities.filter(c => c.is_closed)

  const leaderDetail = leaders.slice(0, 6)
    .map(n => `• ${n.first_name} ${n.last_name} — ${n.received_count} elecciones recibidas`)
    .join("\n")

  const bridgeDetail = bridges.slice(0, 5)
    .map(n => `• ${n.first_name} ${n.last_name}`)
    .join("\n")

  const closedGroupDetail = closedGroups.slice(0, 3).map((c, i) => {
    const names = c.members.slice(0, 6).map(id => nodeMap.get(id)?.first_name).filter(Boolean).join(", ")
    return `• Grupo cerrado ${i + 1} (${c.size} alumnos): ${names}${c.size > 6 ? "…" : ""}`
  }).join("\n")

  const prompt = `Eres un orientador escolar experto en análisis sociométrico. Tu tarea es analizar los datos del sociograma del proceso "${proc.name}" (${proc.school_year}) y producir recomendaciones CONCRETAS y ESPECÍFICAS para ayudar al equipo docente a distribuir a estos ${total} alumnos en clases nuevas el próximo curso.

CONTEXTO IMPORTANTE: Este proceso es de MEZCLA DE CLASES. Los alumnos serán distribuidos en nuevos grupos. El objetivo del informe es guiar esa distribución, NO proponer actividades para la clase actual.

DATOS DEL GRUPO (${total} alumnos, ${responses.length} respuestas):
- Cohesión del grupo: ${(sg.metrics.cohesion * 100).toFixed(1)}% (recíprocos / total)
- Densidad de red: ${(sg.metrics.density * 100).toFixed(1)}%
- Media de elecciones recibidas: ${(sg.nodes.reduce((s, n) => s + n.received_count, 0) / total).toFixed(1)} por alumno
- Pares con amistad recíproca: ${sg.metrics.reciprocal_pairs}
- Subgrupos detectados: ${sg.communities.length} (${closedGroups.length} cerrados)

ALUMNOS AISLADOS (${sg.nodes.filter(n => n.is_isolated).length}) — PRIORIDAD MÁXIMA:
${isolatedDetail || "Ninguno"}

ALUMNOS VULNERABLES — solo 1 vínculo recíproco (${sg.nodes.filter(n => n.is_vulnerable && !n.is_isolated).length}):
${vulnerableDetail || "Ninguno"}

LÍDERES SOCIALES:
${leaderDetail || "Ninguno destacado"}

ALUMNOS PUENTE (conectan subgrupos):
${bridgeDetail || "Ninguno"}

SUBGRUPOS CERRADOS A REPARTIR:
${closedGroupDetail || "Ninguno"}

INSTRUCCIONES PARA EL INFORME:
Escribe exactamente estas tres secciones, sin asteriscos ni markdown, usando solo texto plano:

DIAGNÓSTICO
[2-3 frases sobre la estructura social real del grupo. Sé directo y usa los números.]

ALUMNOS PRIORITARIOS PARA LA MEZCLA
[Lista concisa de decisiones específicas. Para cada alumno aislado o vulnerable, di con quién debería ir o de quién no debe separarse. Nombra a los alumnos. Para grupos cerrados, di cuántos máximo deberían ir juntos.]

CRITERIOS PARA EL ALGORITMO
[3-4 criterios ordenados por prioridad para configurar la mezcla: qué reglas crear, qué alumnos proteger, cómo repartir a los líderes y puentes.]

PROHIBIDO: no uses frases genéricas como "dinámicas de grupo", "tutorías individualizadas", "actividades de cohesión" ni ningún consejo que no dependa de los datos concretos de arriba.`

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
