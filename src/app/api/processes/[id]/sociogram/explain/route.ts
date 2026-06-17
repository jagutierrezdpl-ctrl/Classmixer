import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, logAudit } from "@/lib/auth"
import { generateAISummary } from "@/lib/ai"
import { NextResponse } from "next/server"
import { calculateSociogram } from "@/lib/sociogram/calculate"
import { getQuestionCatalogIndex } from "@/lib/questionnaire/catalog"
import { filterVisibleResponses } from "@/lib/questionnaire/visibility"
import type { SociogramData, SociogramNode } from "@/types"
import type { UserRole } from "@/types"

// Build the structured report using CDC sociometric methodology
// (Coie, Dodge & Coppotelli, 1982 / CIVSOC indices)
function buildReport(sg: SociogramData, proc: { name: string; school_year: string }, responseCount: number): string {
  const total = sg.nodes.length
  const nodeMap = new Map(sg.nodes.map(n => [n.id, n]))
  const m = sg.metrics
  const lines: string[] = []

  // Derived groups
  const isolated     = sg.nodes.filter(n => n.is_isolated)
  const rejected     = sg.nodes.filter(n => n.sociometric_status === "rechazado")
  const neglected    = sg.nodes.filter(n => n.sociometric_status === "ignorado" && !n.is_isolated)
  const popular      = sg.nodes.filter(n => n.sociometric_status === "popular").sort((a, b) => b.received_count - a.received_count)
  const controversial = sg.nodes.filter(n => n.sociometric_status === "controvertido").sort((a, b) => b.received_count - a.received_count)
  const vulnerable   = sg.nodes.filter(n => n.is_vulnerable && !n.is_isolated && n.sociometric_status !== "rechazado")
  const bridges      = sg.nodes.filter(n => n.is_bridge)
  const closedGroups = sg.communities.filter(c => c.is_closed)

  // ── 1. DIAGNÓSTICO DEL CLIMA SOCIAL ─────────────────────────────
  const cgPct  = (m.group_cohesion * 100).toFixed(1)
  const dgPct  = (m.group_dissociation * 100).toFixed(1)
  const cogPct = (m.group_coherence * 100).toFixed(1)
  const denPct = (m.density * 100).toFixed(1)
  const avgR   = (sg.nodes.reduce((s, n) => s + n.received_count, 0) / total).toFixed(1)

  const cohLabel = m.group_cohesion >= 0.15 ? "buena" : m.group_cohesion >= 0.08 ? "moderada" : "baja"

  lines.push(`DIAGNÓSTICO DEL CLIMA SOCIAL — ${proc.name} (${proc.school_year})`)
  lines.push(
    `${total} alumnos · ${responseCount} respuestas · ` +
    `media ${avgR} elecciones recibidas/alumno · ` +
    `${sg.communities.length} subgrupos detectados${closedGroups.length > 0 ? ` (${closedGroups.length} cerrados)` : ""}.`
  )
  lines.push("")
  lines.push(
    `Índices grupales (CIVSOC): ` +
    `Cohesión CG=${cgPct}% (${cohLabel}) · ` +
    `Disociación DG=${dgPct}% · ` +
    `Coherencia CoG=${cogPct}% · ` +
    `Densidad ${denPct}%` +
    (m.has_rejection_data ? "" : " · sin datos de rechazo (pregunta negativa no activa)")
  )

  // CDC counts
  if (m.popular_count + m.rejected_count + m.neglected_count + m.controversial_count > 0) {
    lines.push(
      `Estatus CDC: ${m.popular_count} populares · ` +
      `${m.controversial_count} controvertidos · ` +
      `${m.neglected_count} ignorados · ` +
      (m.has_rejection_data ? `${m.rejected_count} rechazados · ` : "") +
      `${m.average_count} promedio.`
    )
  }
  lines.push("")

  // ── 2. ALUMNOS SIN PRESENCIA SOCIAL (IGNORADOS / AISLADOS) ──────
  // Ignorado CDC: low SI (low LM + low LL) — invisible, not necessarily conflictive
  const needsAttention = [...isolated, ...neglected]
  if (needsAttention.length > 0) {
    lines.push(`ALUMNOS SIN PRESENCIA SOCIAL (${needsAttention.length}) — PRIORIDAD MÁXIMA`)
    for (const n of needsAttention) {
      const statusLabel = n.is_isolated ? "sin ninguna nominación" : `ignorado (zSI=${n.social_impact_z})`
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
        action = `Eligió a ${chose.map(x => x.first_name).join(", ")} pero nadie le eligió — intentar colocarle con uno de ellos y añadir un perfil prosocial en el mismo equipo.`
      } else {
        action = "Sin ninguna conexión bidireccional — crear regla protect_vulnerable y asignar tutor de integración."
      }
      lines.push(`• ${n.first_name} ${n.last_name} [${statusLabel}]: ${action}`)
    }
    lines.push("")
  }

  // ── 3. ALUMNOS RECHAZADOS (sólo si hay datos de rechazo) ────────
  if (rejected.length > 0) {
    lines.push(`ALUMNOS RECHAZADOS (${rejected.length}) — RIESGO DE EXCLUSIÓN ACTIVA`)
    for (const n of rejected) {
      const sp = n.social_preference_z.toFixed(2)
      const ll = n.rejection_received_count
      const lm = n.received_count
      // Heuristic: high LL + low LM → reactive/aggressive; low LM + moderately high LL → passive/victim
      const profile = ll > 0 && lm <= 1
        ? "Perfil pasivo/víctima — escasas elecciones positivas, nominaciones de rechazo acumuladas"
        : "Perfil reactivo — bajo agrado neto, con elecciones de rechazo explícitas"
      lines.push(`• ${n.first_name} ${n.last_name} [zSP=${sp}, ${lm} elec.recibidas / ${ll} rechazos]: ${profile}. No separar de sus pocos vínculos positivos; evitar agrupar con alumnos que le han rechazado.`)
    }
    lines.push("")
  }

  // ── 4. ALUMNOS CON POSICIÓN FRÁGIL (vulnerable pero no CDC rechazado) ─
  if (vulnerable.length > 0) {
    lines.push(`ALUMNOS CON POSICIÓN SOCIAL FRÁGIL (${vulnerable.length}) — NO SEPARAR DE SU ÚNICO VÍNCULO`)
    for (const n of vulnerable) {
      const reciprocalPartners = sg.edges
        .filter(e => e.source === n.id && e.is_reciprocal && e.relation_type === "friendship")
        .map(e => nodeMap.get(e.target)).filter((x): x is SociogramNode => !!x)
      if (reciprocalPartners.length > 0) {
        lines.push(`• ${n.first_name} ${n.last_name} ↔ ${reciprocalPartners.map(p => p.first_name).join(" / ")} — mantener juntos (su único ancla afectiva).`)
      } else {
        lines.push(`• ${n.first_name} ${n.last_name} — sin reciprocidades, baja visibilidad (${n.received_count} elec. recibidas). Colocar cerca de alumnos que le eligieron.`)
      }
    }
    lines.push("")
  }

  // ── 5. POPULARES Y CONTROVERTIDOS — DISTRIBUCIÓN ESTRATÉGICA ─────
  const topBridges = [...bridges].sort((a, b) => (b.betweenness ?? 0) - (a.betweenness ?? 0)).slice(0, 5)
  const leaders = [...popular, ...controversial].slice(0, 6)

  if (leaders.length > 0 || topBridges.length > 0) {
    lines.push("DISTRIBUCIÓN ESTRATÉGICA DE LÍDERES Y PUENTES")

    if (popular.length > 0) {
      const names = popular.slice(0, 4).map(n => `${n.first_name} ${n.last_name} (${n.received_count} elec.)`)
      lines.push(`• Populares prosociales (zSP>1) — repartir entre clases como facilitadores de integración: ${names.join(", ")}.`)
    }
    if (controversial.length > 0) {
      const names = controversial.slice(0, 3).map(n => `${n.first_name} ${n.last_name}`)
      lines.push(`• Controvertidos (alto impacto polarizador) — no juntar entre sí; asignar uno por clase para redirigir su liderazgo: ${names.join(", ")}.`)
    }
    if (topBridges.length > 0) {
      const names = topBridges.map(n => `${n.first_name} ${n.last_name}`)
      const note = bridges.length > total * 0.2 ? ` (top ${topBridges.length} por intermediación)` : ""
      lines.push(`• Alumnos puente${note} (conectores entre subgrupos) — distribuir en clases distintas: ${names.join(", ")}.`)
    }
    lines.push("")
  }

  // ── 6. GRUPOS CERRADOS — REPARTIR ───────────────────────────────
  if (closedGroups.length > 0) {
    lines.push(`SUBGRUPOS CERRADOS — REPARTIR (${closedGroups.length})`)
    for (const g of closedGroups.slice(0, 4)) {
      const names = g.members.slice(0, 6).map(id => nodeMap.get(id)?.first_name).filter(Boolean).join(", ")
      const maxTogether = Math.ceil(g.size / 2)
      lines.push(`• ${g.size} miembros: ${names}${g.size > 6 ? "…" : ""} — máximo ${maxTogether} en la misma clase nueva.`)
    }
    lines.push("")
  }

  // ── 7. CRITERIOS PARA EL ALGORITMO DE MEZCLA ────────────────────
  lines.push("CRITERIOS PARA EL ALGORITMO DE MEZCLA (por prioridad)")
  let p = 1
  if (needsAttention.length > 0)
    lines.push(`${p++}. Regla protect_vulnerable para ${needsAttention.length} alumnos sin presencia social — garantizar al menos un vínculo positivo en la nueva clase.`)
  if (rejected.length > 0)
    lines.push(`${p++}. No juntar alumnos rechazados con quienes les han nominado negativamente — revisar pares conflictivos.`)
  if (vulnerable.length > 0)
    lines.push(`${p++}. Regla should_keep_together para ${vulnerable.length} pares con vínculo frágil — no separar su único ancla afectiva.`)
  if (closedGroups.length > 0)
    lines.push(`${p++}. Regla max_from_group para ${closedGroups.length} subgrupos cerrados — máximo 50% de cada subgrupo por clase.`)
  if (controversial.length > 0)
    lines.push(`${p++}. Repartir los ${controversial.length} alumnos controvertidos — un máximo de 1 por clase nueva.`)
  if (popular.length > 0)
    lines.push(`${p++}. Repartir los ${popular.length} populares prosociales como facilitadores de integración — al menos 1 por clase.`)
  if (topBridges.length > 0)
    lines.push(`${p++}. Distribuir los ${topBridges.length} alumnos puente en clases distintas para preservar la conectividad global.`)
  lines.push(`${p}. Equilibrar nota media, género y clase de origen entre todas las clases nuevas.`)

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

  const [{ data: proc }, { data: center }, { data: allStudents }, { data: allResponses }, { data: docRows }] = await Promise.all([
    supabase.from("processes").select("name, school_year, center_id").eq("id", id).single(),
    supabase.from("centers").select("openrouter_api_key").eq("id", profile.center_id).single(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from("students").select("*").eq("process_id", id).eq("active", true),
    supabase.from("responses").select("*").eq("process_id", id),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from("process_documents").select("name, content_markdown").eq("process_id", id).eq("center_id", profile.center_id).order("created_at"),
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

  // Build document context block (if any PDFs were uploaded)
  const docs = (docRows ?? []) as { name: string; content_markdown: string }[]
  const docContext = docs.length > 0
    ? "\n\n---\nDOCUMENTOS DE CONTEXTO DEL CENTRO:\n" +
      docs.map(d => `### ${d.name}\n${d.content_markdown.slice(0, 3000)}`).join("\n\n")
    : ""

  // Optional: use LLM only for a brief 2-sentence qualitative context paragraph
  const apiKey = (center as { openrouter_api_key?: string | null } | null)?.openrouter_api_key
  if (apiKey) {
    try {
      const cohPct = (sg.metrics.cohesion * 100).toFixed(0)
      const isolated = sg.nodes.filter(n => n.is_isolated)
      const docNote = docs.length > 0
        ? ` Ten en cuenta el contexto adicional del centro aportado al final del mensaje.`
        : ""
      const narrativePrompt =
        `En 2 frases concisas y directas, describe la dinámica social de este grupo escolar de ${sg.nodes.length} alumnos que tiene una cohesión del ${cohPct}%, ${isolated.length} alumnos completamente aislados y ${sg.communities.length} subgrupos detectados. Sin recomendaciones, solo descripción del estado social actual. En español.${docNote}${docContext}`
      const narrative = await generateAISummary(narrativePrompt, apiKey)
      return NextResponse.json({ summary: `CONTEXTO\n${narrative.trim()}\n\n${report}` })
    } catch {
      // Fall through to return just the programmatic report
    }
  }

  return NextResponse.json({ summary: report })
}
