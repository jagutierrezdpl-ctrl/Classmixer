/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, hasFullAccess, logAudit, verifyProcessAccess } from "@/lib/auth"
import { NextResponse } from "next/server"
import { calculateSociogram } from "@/lib/sociogram/calculate"
import { getQuestionCatalogIndex } from "@/lib/questionnaire/catalog"
import { filterVisibleResponses } from "@/lib/questionnaire/visibility"
import { generateAISummary, SOCIOMETRY_SYSTEM_PROMPT } from "@/lib/ai"
import type { UserRole } from "@/types"

// GET — load existing AI reports for this student in this process
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; studentId: string }> }
) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (!hasFullAccess(profile.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 })

  const { id, studentId } = await params

  if (!(await verifyProcessAccess(id, profile.center_id))) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  }

  const supabase = createServiceClient()

  const { data } = await (supabase as any)
    .from("ai_reports")
    .select("*")
    .eq("process_id", id)
    .eq("report_type", "student")
    .contains("metadata", { student_id: studentId } as any)
    .order("created_at", { ascending: false })
    .limit(5)

  return NextResponse.json(data ?? [])
}

// POST — generate a formal psychopedagogical AI report for a student
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; studentId: string }> }
) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (!hasFullAccess(profile.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 })

  const { id, studentId } = await params
  const supabase = createServiceClient()

  const [{ data: process }, { data: student }] = await Promise.all([
    supabase.from("processes").select("center_id, name, school_year, target_level").eq("id", id).eq("center_id", profile.center_id).single(),
    supabase.from("students").select("*").eq("id", studentId).eq("process_id", id).single(),
  ])

  if (!process || !student) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const additionalContext = body.additional_context ?? ""

  const [{ data: allStudents }, { data: allResponses }] = await Promise.all([
    supabase.from("students").select("*").eq("process_id", id).eq("active", true),
    supabase.from("responses").select("*").eq("process_id", id),
  ])

  const catalogIndex = await getQuestionCatalogIndex(profile.center_id)
  const responses = filterVisibleResponses(
    allResponses ?? [],
    profile.role as UserRole,
    catalogIndex.sensitivity,
  )

  const soc = calculateSociogram(
    (allStudents ?? []) as any,
    responses as any,
    catalogIndex.scoringRoles.friendshipLike,
    catalogIndex.excludedFromGraph,
    catalogIndex.scoringRoles.negativeLike,
  )

  const node = soc.nodes.find(n => n.id === studentId)
  if (!node) return NextResponse.json({ error: "Alumno no encontrado en el sociograma" }, { status: 404 })

  // Build contextual data for the report
  const outgoingFriends = soc.edges
    .filter(e => e.source === studentId && e.relation_type === "friendship")
    .map(e => {
      const t = soc.nodes.find(n => n.id === e.target)
      return t ? `${t.first_name} ${t.last_name}${e.is_reciprocal ? " (recíproco)" : ""}` : null
    }).filter(Boolean).slice(0, 5)

  const rejectors = soc.edges
    .filter(e => e.target === studentId && e.relation_type === "negative")
    .map(e => {
      const s = soc.nodes.find(n => n.id === e.source)
      return s ? `${s.first_name} ${s.last_name}` : null
    }).filter(Boolean).slice(0, 5)

  const community = soc.communities.find(c => c.members.includes(studentId))
  const communitySize = community?.size ?? 0

  const prompt = `Genera un INFORME PSICOPEDAGÓGICO SOCIOMÉTRICO formal para el siguiente alumno/a.

DATOS DEL ALUMNO:
- Nombre: ${student.first_name} ${student.last_name}
- Clase actual: ${student.current_class ?? "—"}
- Género: ${student.gender ?? "—"}
- Nota media: ${student.average_grade ?? "—"}
- Nivel académico: ${student.academic_level ?? "—"}
- Conducta: ${student.behavior_level ?? "—"}
- Necesidades educativas: ${student.needs_type ?? "No"}
- Proceso: ${process.name} (${process.school_year})

DATOS SOCIOMÉTRICOS (CDC):
- Estatus sociométrico: ${node.sociometric_status ?? "promedio"}
- Elecciones recibidas (LM): ${node.received_count}
- Rechazos recibidos (LL): ${node.rejection_received_count ?? 0}
- Elecciones realizadas: ${node.given_count}
- Relaciones recíprocas: ${node.reciprocal_count}
- Centralidad: ${(node.centrality * 100).toFixed(1)}%
- Intermediación (puente): ${(node.betweenness * 100).toFixed(1)}%
- z-SP (Preferencia Social): ${node.social_preference_z?.toFixed(3) ?? "—"}
- z-SI (Impacto Social): ${node.social_impact_z?.toFixed(3) ?? "—"}
- ¿Aislado?: ${node.is_isolated ? "Sí" : "No"}
- ¿Vulnerable?: ${node.is_vulnerable ? "Sí" : "No"}
- Comunidad social: ${communitySize} miembros

VÍNCULOS POSITIVOS (elige a):
${outgoingFriends.length > 0 ? outgoingFriends.map(n => `• ${n}`).join("\n") : "• Sin elecciones registradas"}

NOMINACIONES DE RECHAZO RECIBIDAS (confidencial):
${rejectors.length > 0 ? rejectors.map(n => `• ${n}`).join("\n") : "• Ninguna"}

${additionalContext ? `CONTEXTO ADICIONAL DEL EQUIPO:\n${additionalContext}` : ""}

CONTEXTO DEL GRUPO:
- Cohesión grupal: ${(soc.metrics.cohesion * 100).toFixed(1)}%
- Densidad: ${(soc.metrics.density * 100).toFixed(1)}%
- Total alumnos: ${soc.nodes.length}

INSTRUCCIONES PARA EL INFORME:
Redacta un informe psicopedagógico estructurado con las siguientes secciones:

1. **DATOS DE IDENTIFICACIÓN** — nombre, grupo, proceso
2. **ESTATUS SOCIOMÉTRICO** — descripción técnica del estatus CDC y qué significa clínicamente (con los z-scores)
3. **ANÁLISIS DE LA RED SOCIAL** — vínculos positivos, vulnerabilidades, posición en la comunidad
4. **SEÑALES DE ALERTA** — si las hay, describe el riesgo de forma objetiva (no acusatoria)
5. **RECOMENDACIONES DE MEZCLA** — indicaciones concretas para la distribución del alumno en el próximo curso
6. **PROPUESTA DE INTERVENCIÓN** — acciones concretas ordenadas por urgencia (máx 5 acciones)
7. **NOTA PARA EL TUTOR** — resumen de una sola frase orientativa para el próximo tutor

Usa lenguaje técnico pero comprensible para el equipo docente. Añade al final una línea que diga:
"[BORRADOR — Informe generado por IA. Debe ser revisado y firmado por el/la orientador/a antes de su uso oficial.]"
`

  // Load center's AI config
  const { data: centerData } = await supabase
    .from("centers")
    .select("openrouter_api_key, openrouter_model")
    .eq("id", profile.center_id)
    .single()
  const apiKey = (centerData as any)?.openrouter_api_key as string | null | undefined
  const aiModel = (centerData as any)?.openrouter_model as string | null | undefined

  const systemPrompt = SOCIOMETRY_SYSTEM_PROMPT +
    "\n\nActúa como orientador escolar redactando informes psicopedagógicos formales. Usa formato markdown con encabezados ## y listas estructuradas."

  const aiResponse = await generateAISummary(prompt, apiKey, systemPrompt, aiModel)

  const reportContent = typeof aiResponse === "string" ? aiResponse : JSON.stringify(aiResponse)

  // Persist in ai_reports
  const { data: saved, error } = await (supabase as any)
    .from("ai_reports")
    .insert({
      process_id: id,
      report_type: "student",
      content: reportContent,
      created_by: profile.id,
      created_by_name: profile.name,
      metadata: { student_id: studentId, student_name: `${student.first_name} ${student.last_name}` },
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit(profile.id, profile.center_id, "generate_ai_student_report", "student", {
    processId: id,
    metadata: { student_id: studentId },
  })
  return NextResponse.json({ report: reportContent, id: saved.id })
}