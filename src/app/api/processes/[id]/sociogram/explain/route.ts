import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, logAudit } from "@/lib/auth"
import { generateAISummary } from "@/lib/ai"
import { NextResponse } from "next/server"
import { calculateSociogram } from "@/lib/sociogram/calculate"
import { getQuestionCatalogIndex } from "@/lib/questionnaire/catalog"
import { filterVisibleResponses } from "@/lib/questionnaire/visibility"
import type { SociogramData, SociogramNode } from "@/types"
import type { UserRole } from "@/types"

// Build the structured report from computed sociogram data — no LLM needed for this part
function buildReport(sg: SociogramData, proc: { name: string; school_year: string }, responseCount: number): string {
  const total = sg.nodes.length
  const nodeMap = new Map(sg.nodes.map(n => [n.id, n]))
  const lines: string[] = []

  // ── DIAGNÓSTICO ──────────────────────────────────────────────────
  const cohPct = (sg.metrics.cohesion * 100).toFixed(0)
  const denPct = (sg.metrics.density * 100).toFixed(1)
  const avgR = (sg.nodes.reduce((s, n) => s + n.received_count, 0) / total).toFixed(1)
  const isolated = sg.nodes.filter(n => n.is_isolated)
  const vulnerable = sg.nodes.filter(n => n.is_vulnerable && !n.is_isolated)
  const leaders = sg.nodes.filter(n => n.is_leader).sort((a, b) => b.received_count - a.received_count)
  const bridges = sg.nodes.filter(n => n.is_bridge)
  const closedGroups = sg.communities.filter(c => c.is_closed)

  const cohLabel = Number(cohPct) >= 50 ? "buena" : Number(cohPct) >= 30 ? "moderada" : "baja"

  lines.push(`DIAGNÓSTICO — ${proc.name} (${proc.school_year})`)
  lines.push(
    `${total} alumnos analizados con ${responseCount} respuestas. ` +
    `Cohesión ${cohPct}% (${cohLabel}), densidad de red ${denPct}%, ` +
    `media de ${avgR} elecciones recibidas por alumno. ` +
    `${sg.communities.length} subgrupos detectados` +
    (closedGroups.length > 0 ? `, ${closedGroups.length} de ellos cerrados.` : ".")
  )
  lines.push("")

  // ── AISLADOS ─────────────────────────────────────────────────────
  if (isolated.length > 0) {
    lines.push(`ALUMNOS AISLADOS (${isolated.length}) — PRIORIDAD MÁXIMA`)
    for (const n of isolated) {
      const choosers = sg.edges
        .filter(e => e.target === n.id && e.relation_type === "friendship")
        .map(e => nodeMap.get(e.source)).filter((x): x is SociogramNode => !!x)
      const chose = sg.edges
        .filter(e => e.source === n.id && e.relation_type === "friendship")
        .map(e => nodeMap.get(e.target)).filter((x): x is SociogramNode => !!x)

      let action: string
      if (choosers.length > 0) {
        action = `Le eligió ${choosers.map(x => x.first_name).join(", ")} — colocar en la misma clase que uno de ellos.`
      } else if (chose.length > 0) {
        action = `Eligió a ${chose.map(x => x.first_name).join(", ")} pero nadie le eligió — intentar colocarle con uno de ellos.`
      } else {
        action = `Sin ninguna conexión en ambas direcciones — crear regla "protect_vulnerable".`
      }
      lines.push(`• ${n.first_name} ${n.last_name}: ${action}`)
    }
    lines.push("")
  }

  // ── VULNERABLES ──────────────────────────────────────────────────
  if (vulnerable.length > 0) {
    const shown = vulnerable.slice(0, 12)
    lines.push(`ALUMNOS CON UN SOLO VÍNCULO (${vulnerable.length}) — NO SEPARAR DE SU ÚNICO AMIGO`)
    for (const n of shown) {
      const reciprocal = sg.edges
        .filter(e => e.source === n.id && e.relation_type === "friendship")
        .filter(e => sg.edges.some(e2 => e2.source === e.target && e2.target === n.id && e2.relation_type === "friendship"))
        .map(e => nodeMap.get(e.target)).filter((x): x is SociogramNode => !!x)
      if (reciprocal.length > 0) {
        lines.push(`• ${n.first_name} ${n.last_name} ↔ ${reciprocal[0].first_name} ${reciprocal[0].last_name} — no separarlos.`)
      }
    }
    if (vulnerable.length > 12) lines.push(`  … y ${vulnerable.length - 12} más con el mismo criterio.`)
    lines.push("")
  }

  // ── GRUPOS CERRADOS ──────────────────────────────────────────────
  if (closedGroups.length > 0) {
    lines.push(`GRUPOS CERRADOS — REPARTIR (${closedGroups.length})`)
    for (const g of closedGroups.slice(0, 4)) {
      const names = g.members.slice(0, 6).map(id => nodeMap.get(id)?.first_name).filter(Boolean).join(", ")
      const maxTogether = Math.ceil(g.size / 2)
      lines.push(`• ${g.size} alumnos: ${names}${g.size > 6 ? "…" : ""} — máximo ${maxTogether} en la misma clase.`)
    }
    lines.push("")
  }

  // ── DISTRIBUCIÓN ESTRATÉGICA ─────────────────────────────────────
  const hasStrategic = bridges.length > 0 || leaders.length > 0
  if (hasStrategic) {
    lines.push("DISTRIBUCIÓN ESTRATÉGICA")
    if (bridges.length > 0) {
      const names = bridges.slice(0, 5).map(n => `${n.first_name} ${n.last_name}`).join(", ")
      lines.push(`• Puentes sociales — distribuir en clases distintas para integrar subgrupos: ${names}.`)
    }
    if (leaders.length > 0) {
      const names = leaders.slice(0, 5).map(n => `${n.first_name} ${n.last_name} (${n.received_count})`).join(", ")
      lines.push(`• Líderes — repartir entre clases para equilibrio social: ${names}.`)
    }
    lines.push("")
  }

  // ── CRITERIOS PARA EL ALGORITMO ──────────────────────────────────
  lines.push("CRITERIOS PARA EL ALGORITMO (por prioridad)")

  let priority = 1
  if (isolated.length > 0) {
    lines.push(`${priority++}. Crear regla "protect_vulnerable" para los ${isolated.length} alumnos aislados.`)
  }
  if (vulnerable.length > 0) {
    lines.push(`${priority++}. Crear reglas "should_keep_together" para los ${vulnerable.length} pares vulnerables.`)
  }
  if (closedGroups.length > 0) {
    lines.push(`${priority++}. Crear reglas "max_from_group" para los ${closedGroups.length} subgrupos cerrados.`)
  }
  if (bridges.length > 0) {
    lines.push(`${priority++}. Distribuir los ${bridges.length} alumnos puente en clases diferentes (must_separate si hay solo 2 clases).`)
  }
  if (leaders.length > 0) {
    lines.push(`${priority++}. Repartir los ${leaders.length} líderes equitativamente — no más de 1-2 por clase.`)
  }
  lines.push(`${priority}. Equilibrar nota media, género y clase de origen entre los grupos nuevos.`)

  return lines.join("\n")
}

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
      summary: "No hay respuestas al cuestionario todavía. Los alumnos deben completar el cuestionario primero.",
    })
  }

  if (profile.role === "orientador") {
    await logAudit(profile.id, profile.center_id, "view_sociogram_ai", "process", {
      processId: id,
      metadata: { role: profile.role },
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const students = (allStudents as any[]).filter((s: any) => !s.excluded_from_mix)
  const catalogIndex = await getQuestionCatalogIndex(profile.center_id)
  const responses = filterVisibleResponses(allResponses ?? [], profile.role as UserRole, catalogIndex.sensitivity)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sg = calculateSociogram(students as any, responses as any, catalogIndex.scoringRoles.friendshipLike, catalogIndex.excludedFromGraph)

  if (sg.nodes.length === 0) {
    return NextResponse.json({ summary: "No hay datos suficientes para generar un análisis." })
  }

  // Generate the structured report from data (no LLM)
  const report = buildReport(sg, proc, responses.length)

  // Optional: use LLM only for a brief 2-sentence qualitative context paragraph
  const apiKey = (center as { openrouter_api_key?: string | null } | null)?.openrouter_api_key
  if (apiKey) {
    try {
      const cohPct = (sg.metrics.cohesion * 100).toFixed(0)
      const isolated = sg.nodes.filter(n => n.is_isolated)
      const narrativePrompt = `En 2 frases concisas y directas, describe la dinámica social de este grupo escolar de ${sg.nodes.length} alumnos que tiene una cohesión del ${cohPct}%, ${isolated.length} alumnos completamente aislados y ${sg.communities.length} subgrupos detectados. Sin recomendaciones, solo descripción del estado social actual. En español.`
      const narrative = await generateAISummary(narrativePrompt, apiKey)
      return NextResponse.json({ summary: `CONTEXTO\n${narrative.trim()}\n\n${report}` })
    } catch {
      // Fall through to return just the programmatic report
    }
  }

  return NextResponse.json({ summary: report })
}
