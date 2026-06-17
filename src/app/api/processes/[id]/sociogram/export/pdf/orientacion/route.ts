/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, hasFullAccess, logAudit } from "@/lib/auth"
import { NextResponse } from "next/server"
import React from "react"
import { Document, Page, Text, View, Svg, Circle, Line, Polygon, renderToBuffer } from "@react-pdf/renderer"
import { calculateSociogram } from "@/lib/sociogram/calculate"
import { pdfStyles, formatDate, ALERT_STYLE_BY_SEVERITY, PdfLogoRow } from "@/lib/pdf/shared"
import { getQuestionCatalogIndex } from "@/lib/questionnaire/catalog"

// ── Layout helpers ────────────────────────────────────────────────────────────
const SOC_CX = 260, SOC_CY = 195, SOC_R = 158

function circleLayout<T extends { id: string }>(nodes: T[]) {
  const n = nodes.length
  return nodes.map((node, i) => {
    const angle = (2 * Math.PI * i) / Math.max(n, 1) - Math.PI / 2
    return { node, x: SOC_CX + SOC_R * Math.cos(angle), y: SOC_CY + SOC_R * Math.sin(angle), index: i + 1 }
  })
}

// Returns line endpoint + arrowhead polygon points for a directed edge
function directedArrow(x1: number, y1: number, x2: number, y2: number, sourceR: number, targetR: number) {
  const dx = x2 - x1, dy = y2 - y1
  const len = Math.sqrt(dx * dx + dy * dy) || 1
  const ux = dx / len, uy = dy / len
  const px = -uy, py = ux
  // Shorten line to start/end at node edge
  const lx1 = x1 + ux * (sourceR + 1), ly1 = y1 + uy * (sourceR + 1)
  const tipX = x2 - ux * (targetR + 1), tipY = y2 - uy * (targetR + 1)
  const baseX = tipX - ux * 7, baseY = tipY - uy * 7
  const hw = 3.5
  return {
    lx1, ly1, lx2: baseX, ly2: baseY,
    points: `${tipX.toFixed(1)},${tipY.toFixed(1)} ${(baseX + px * hw).toFixed(1)},${(baseY + py * hw).toFixed(1)} ${(baseX - px * hw).toFixed(1)},${(baseY - py * hw).toFixed(1)}`,
  }
}

// ── Rejection sociogram SVG ───────────────────────────────────────────────────
function RejectionGraph({
  nodes,
  negativeResponses,
}: {
  nodes: ReturnType<typeof calculateSociogram>["nodes"]
  negativeResponses: { respondent_student_id: string; target_student_id: string }[]
}) {
  if (negativeResponses.length === 0) return null as any

  const positions = circleLayout(nodes)
  const posById = new Map(positions.map(p => [p.node.id, p]))
  const sourceR = 4.5

  return React.createElement(Svg, { width: "100%", height: 390, viewBox: "0 0 520 390" } as any,
    // Rejection arrows
    ...negativeResponses.flatMap((r, i) => {
      const a = posById.get(r.respondent_student_id)
      const b = posById.get(r.target_student_id)
      if (!a || !b || a === b) return []
      const bR = 4.5 + Math.min((b.node.rejection_received_count ?? 0), 10) * 0.55
      const { lx1, ly1, lx2, ly2, points } = directedArrow(a.x, a.y, b.x, b.y, sourceR, bR)
      return [
        React.createElement(Line, {
          key: `l${i}`,
          x1: lx1, y1: ly1, x2: lx2, y2: ly2,
          stroke: "#dc2626", strokeWidth: 0.65, strokeOpacity: 0.4,
        } as any),
        React.createElement(Polygon, {
          key: `a${i}`,
          points,
          fill: "#dc2626", fillOpacity: 0.6,
        } as any),
      ]
    }),
    // Nodes
    ...positions.map(p => {
      const rej = p.node.rejection_received_count ?? 0
      const r = 4.5 + Math.min(rej, 10) * 0.55
      const fill = rej === 0 ? "#cbd5e1" : rej >= 8 ? "#7f1d1d" : rej >= 4 ? "#dc2626" : "#f97316"
      return React.createElement(React.Fragment, { key: p.node.id },
        React.createElement(Circle, { cx: p.x, cy: p.y, r, fill, stroke: "#fff", strokeWidth: 0.7 } as any),
        React.createElement(Text, {
          x: p.x, y: p.y + 2.5,
          style: { fontSize: 4.5, fill: "#fff", textAnchor: "middle" } as any,
        } as any, String(p.index)),
      )
    }),
  )
}

function nameOf(s: any): string {
  return s ? `${s.first_name} ${s.last_name}` : "Alumno desconocido"
}

// ── PDF document ──────────────────────────────────────────────────────────────
function OrientacionPDF({
  process, soc, studentMap, separationRules, negativeNominationsTotal, negativeResponses, logoUrl,
}: {
  process: any
  soc: ReturnType<typeof calculateSociogram>
  studentMap: Map<string, any>
  separationRules: string[]
  negativeNominationsTotal: number
  negativeResponses: { respondent_student_id: string; target_student_id: string }[]
  logoUrl?: string | null
}) {
  const isolated = soc.nodes.filter(n => n.is_isolated)

  // Rechazados CDC have their own section — exclude them from the "fragile" list
  // to avoid misclassifying active rejection as passive shyness (Tristan-type error)
  const vulnerable = soc.nodes.filter(
    n => n.is_vulnerable && !n.is_isolated && n.sociometric_status !== "rechazado"
  )
  const rejected = [...soc.nodes]
    .filter(n => n.sociometric_status === "rechazado")
    .sort((a, b) => (b.rejection_received_count ?? 0) - (a.rejection_received_count ?? 0))
  const controversial = [...soc.nodes]
    .filter(n => n.sociometric_status === "controvertido")
    .sort((a, b) => (b.rejection_received_count ?? 0) - (a.rejection_received_count ?? 0))

  // Bullying risk = CDC rechazado + clinically significant rejection volume (>=5)
  const bullyingRisk = rejected.filter(n => (n.rejection_received_count ?? 0) >= 5)

  const closedGroups = soc.communities.filter(c => c.is_closed)
  const hasRejData = soc.metrics.has_rejection_data

  // Precompute positions for legend table (same order as SVG graph)
  const positions = circleLayout(soc.nodes)

  return React.createElement(Document, null,

    // ── Página 1: Resumen + alertas de acoso + rechazados CDC ────────────────
    React.createElement(Page, { size: "A4", style: pdfStyles.page },
      React.createElement(PdfLogoRow, { logoUrl }),
      React.createElement(View, { style: pdfStyles.header },
        React.createElement(Text, { style: pdfStyles.title }, "Informe para orientacion"),
        React.createElement(Text, { style: pdfStyles.subtitle }, `${process.name} · ${process.school_year} · ${formatDate()}`),
        React.createElement(View, { style: pdfStyles.metaRow },
          React.createElement(View, { style: pdfStyles.confidentialBadge },
            React.createElement(Text, null, "Datos sensibles — acceso restringido y registrado")),
        ),
      ),

      React.createElement(Text, { style: pdfStyles.sectionTitle }, "Resumen sociometrico"),
      React.createElement(View, { style: pdfStyles.summaryGrid },
        React.createElement(View, { style: pdfStyles.summaryCard },
          React.createElement(Text, { style: pdfStyles.summaryValue }, String(isolated.length)),
          React.createElement(Text, { style: pdfStyles.summaryLabel }, "Aislamiento total (0 votos)")),
        React.createElement(View, { style: pdfStyles.summaryCard },
          React.createElement(Text, { style: pdfStyles.summaryValue }, String(rejected.length)),
          React.createElement(Text, { style: pdfStyles.summaryLabel }, "Rechazados CDC")),
        React.createElement(View, { style: pdfStyles.summaryCard },
          React.createElement(Text, { style: pdfStyles.summaryValue }, String(bullyingRisk.length)),
          React.createElement(Text, { style: pdfStyles.summaryLabel }, "Riesgo acoso (>=5 rechazos)")),
        React.createElement(View, { style: pdfStyles.summaryCard },
          React.createElement(Text, { style: pdfStyles.summaryValue }, String(vulnerable.length)),
          React.createElement(Text, { style: pdfStyles.summaryLabel }, "Posicion social fragil")),
        React.createElement(View, { style: pdfStyles.summaryCard },
          React.createElement(Text, { style: pdfStyles.summaryValue }, String(controversial.length)),
          React.createElement(Text, { style: pdfStyles.summaryLabel }, "Controvertidos CDC")),
        React.createElement(View, { style: pdfStyles.summaryCard },
          React.createElement(Text, { style: pdfStyles.summaryValue }, String(negativeNominationsTotal)),
          React.createElement(Text, { style: pdfStyles.summaryLabel }, "Nominaciones negativas totales")),
      ),

      // Bullying risk block — shown prominently at top when present
      bullyingRisk.length > 0
        ? React.createElement(View, null,
            React.createElement(Text, { style: { ...pdfStyles.sectionTitle, color: "#b91c1c", marginTop: 12 } },
              "ALERTA URGENTE — Riesgo de exclusion activa / acoso escolar"),
            React.createElement(Text, { style: { fontSize: 8, color: "#64748b", marginBottom: 6, lineHeight: 1.4 } },
              "Alumnos clasificados como Rechazados (CDC) con 5 o mas nominaciones de dificultad relacional recibidas. " +
              "No representan una 'vulnerabilidad pasiva': sufren rechazo activo severo con alto riesgo de victimizacion. " +
              "Requieren revision individualizada e inmediata, independiente del proceso de mezcla."),
            ...bullyingRisk.map(n =>
              React.createElement(View, { key: n.id, style: ALERT_STYLE_BY_SEVERITY.high },
                React.createElement(Text, { style: { ...pdfStyles.alertText, marginBottom: 2 } },
                  `${n.first_name} ${n.last_name} (${n.current_class})`),
                React.createElement(Text, { style: pdfStyles.alertText },
                  `Rechazos recibidos: ${n.rejection_received_count ?? 0}  |  ` +
                  `Amistades positivas recibidas: ${n.received_count}  |  ` +
                  `Relaciones reciprocas: ${n.reciprocal_count}  |  ` +
                  `zSP: ${(n.social_preference_z ?? 0).toFixed(2)}`),
              )
            ),
          )
        : null,

      // CDC Rechazados (full list)
      React.createElement(Text, { style: pdfStyles.sectionTitle }, "Perfiles rechazados — clasificacion CDC (Coie y Dodge, 1982)"),
      !hasRejData
        ? React.createElement(Text, { style: { fontSize: 9, color: "#64748b" } },
            "Sin datos de elecciones negativas. Activar la pregunta de dificultad relacional en el cuestionario para obtener la clasificacion CDC completa.")
        : rejected.length > 0
          ? React.createElement(View, null, ...rejected.map(n =>
              React.createElement(View, { key: n.id, style: (n.rejection_received_count ?? 0) >= 5 ? ALERT_STYLE_BY_SEVERITY.high : ALERT_STYLE_BY_SEVERITY.medium },
                React.createElement(Text, { style: pdfStyles.alertText },
                  `${n.first_name} ${n.last_name} (${n.current_class}) — ` +
                  `Rechazos: ${n.rejection_received_count ?? 0}  ·  ` +
                  `Amistades: ${n.received_count}  ·  ` +
                  `Reciprocas: ${n.reciprocal_count}  ·  ` +
                  `zSP: ${(n.social_preference_z ?? 0).toFixed(2)}` +
                  ((n.rejection_received_count ?? 0) >= 5 ? " — REVISION PRIORITARIA" : "")))
            ))
          : React.createElement(Text, { style: { fontSize: 9, color: "#64748b" } }, "No se detectaron alumnos con perfil rechazado CDC."),

      React.createElement(View, { style: pdfStyles.footer, fixed: true },
        React.createElement(Text, { style: pdfStyles.footerText }, "ClassMixer · Informe de orientacion — confidencial, no distribuir"),
        React.createElement(Text, { style: pdfStyles.footerText, render: ({ pageNumber, totalPages }: any) => `Pag. ${pageNumber} / ${totalPages}` }),
      ),
    ),

    // ── Página 2: Aislados, frágiles, controvertidos, subgrupos, reglas ──────
    React.createElement(Page, { size: "A4", style: pdfStyles.page },

      React.createElement(Text, { style: pdfStyles.sectionTitle }, "Aislamiento total (0 votos de amistad recibidos)"),
      isolated.length > 0
        ? React.createElement(View, null, ...isolated.map(n =>
            React.createElement(View, { key: n.id, style: ALERT_STYLE_BY_SEVERITY.high },
              React.createElement(Text, { style: pdfStyles.alertText },
                `${n.first_name} ${n.last_name} (${n.current_class}) — ` +
                `0 elecciones de amistad recibidas · ${n.given_count} emitidas · ` +
                `Perfil CDC: ${n.sociometric_status ?? "no clasificado"}`))
          ))
        : React.createElement(Text, { style: { fontSize: 9, color: "#64748b" } }, "No se han detectado alumnos en aislamiento total."),

      React.createElement(Text, { style: pdfStyles.sectionTitle },
        "Posicion social fragil — dependencia de un unico vinculo (excluyendo rechazados CDC)"),
      React.createElement(Text, { style: { fontSize: 8, color: "#64748b", marginBottom: 6 } },
        "Los rechazados CDC tienen su propia seccion (pag. 1). Este bloque muestra solo alumnos con baja conexion sin rechazo activo."),
      vulnerable.length > 0
        ? React.createElement(View, null, ...vulnerable.map(n =>
            React.createElement(View, { key: n.id, style: ALERT_STYLE_BY_SEVERITY.medium },
              React.createElement(Text, { style: pdfStyles.alertText },
                `${n.first_name} ${n.last_name} (${n.current_class}) — ` +
                `${n.received_count} voto(s) · ${n.reciprocal_count} reciproca(s). ` +
                `Si se separa de su unico vinculo en la mezcla, quedara sin conexiones.`))
          ))
        : React.createElement(Text, { style: { fontSize: 9, color: "#64748b" } }, "No se han detectado alumnos en dependencia de vinculo unico (excluidos rechazados CDC)."),

      controversial.length > 0
        ? React.createElement(View, null,
            React.createElement(Text, { style: pdfStyles.sectionTitle }, "Perfil controvertido CDC (visibilidad alta + rechazo significativo)"),
            ...controversial.map(n =>
              React.createElement(View, { key: n.id, style: ALERT_STYLE_BY_SEVERITY.medium },
                React.createElement(Text, { style: pdfStyles.alertText },
                  `${n.first_name} ${n.last_name} (${n.current_class}) — ` +
                  `${n.received_count} amistad(es) recibidas · ${n.rejection_received_count ?? 0} rechazo(s). ` +
                  `Polariza al grupo. Considerar ubicar en clases distintas.`))
            ),
          )
        : null,

      React.createElement(Text, { style: pdfStyles.sectionTitle }, "Subgrupos cerrados detectados"),
      closedGroups.length > 0
        ? React.createElement(View, null, ...closedGroups.map(g =>
            React.createElement(View, { key: g.id, style: ALERT_STYLE_BY_SEVERITY.medium },
              React.createElement(Text, { style: pdfStyles.alertText },
                `Subgrupo cerrado de ${g.size} alumnos: ${g.members.map(id => nameOf(studentMap.get(id))).join(", ")}`))
          ))
        : React.createElement(Text, { style: { fontSize: 9, color: "#64748b" } }, "No se han detectado subgrupos cerrados."),

      React.createElement(Text, { style: pdfStyles.sectionTitle }, "Reglas de separacion activas"),
      separationRules.length > 0
        ? React.createElement(View, null, ...separationRules.map((c, i) =>
            React.createElement(View, { key: i, style: ALERT_STYLE_BY_SEVERITY.high },
              React.createElement(Text, { style: pdfStyles.alertText }, c))
          ))
        : React.createElement(Text, { style: { fontSize: 9, color: "#64748b" } }, "No hay reglas de separacion obligatoria configuradas."),

      negativeNominationsTotal > 0
        ? React.createElement(View, { style: { marginTop: 10 } },
            React.createElement(Text, { style: pdfStyles.sectionTitle }, "Red de tension — nominaciones negativas"),
            React.createElement(View, { style: ALERT_STYLE_BY_SEVERITY.medium },
              React.createElement(Text, { style: pdfStyles.alertText },
                `Total: ${negativeNominationsTotal} nominaciones de dificultad relacional en el cuestionario. ` +
                `No representan un unico conflicto: son una red de tension activa entre alumnos. ` +
                `El sociograma de rechazos se muestra en la pagina siguiente.`))
          )
        : null,

      React.createElement(Text, { style: pdfStyles.sectionTitle }, "Recomendaciones para el equipo de orientacion"),
      ...[
        bullyingRisk.length > 0
          ? `URGENTE: ${bullyingRisk.map(n => `${n.first_name} ${n.last_name}`).join(", ")} — riesgo critico de exclusion activa. Verificar con tutoria antes de cualquier mezcla.`
          : null,
        rejected.length > 0
          ? `Situar a los ${rejected.length} alumno(s) rechazados CDC en clases donde no coincidan con sus principales nominadores de rechazo.`
          : null,
        isolated.length > 0 ? `Revisar individualmente a los ${isolated.length} alumno(s) en aislamiento total.` : null,
        vulnerable.length > 0 ? `Conservar al menos un vinculo reciproco para los ${vulnerable.length} alumno(s) en posicion fragil al generar clases.` : null,
        closedGroups.length > 0 ? `Repartir los subgrupos cerrados entre varias clases para favorecer la integracion.` : null,
        separationRules.length > 0 ? `Verificar que las reglas de separacion obligatoria estan activas en el algoritmo.` : null,
        "Si el cuestionario no incluye la pregunta de dificultad relacional, activarla en el proximo proceso para obtener la clasificacion CDC completa.",
      ].filter(Boolean).map((r, i) =>
        React.createElement(Text, { key: i, style: { fontSize: 9, marginBottom: 4 } }, `· ${r}`)
      ),

      React.createElement(View, { style: pdfStyles.footer, fixed: true },
        React.createElement(Text, { style: pdfStyles.footerText }, "ClassMixer · Informe de orientacion — confidencial, no distribuir"),
        React.createElement(Text, { style: pdfStyles.footerText, render: ({ pageNumber, totalPages }: any) => `Pag. ${pageNumber} / ${totalPages}` }),
      ),
    ),

    // ── Página 3: Sociograma de rechazos (solo si hay datos negativos) ────────
    negativeNominationsTotal > 0
      ? React.createElement(Page, { size: "A4", style: pdfStyles.page },
          React.createElement(Text, { style: pdfStyles.sectionTitle }, "Sociograma de rechazos — red de dificultad relacional"),
          React.createElement(Text, { style: { fontSize: 8, color: "#64748b", marginBottom: 6, lineHeight: 1.4 } },
            "Las flechas rojas muestran nominaciones de dificultad relacional (quien rechaza a quien). " +
            "El tamano y la intensidad del rojo de cada nodo refleja el volumen de rechazos recibidos: " +
            "gris = 0 rechazos, naranja = 1-3, rojo = 4-7, rojo oscuro = 8+. " +
            "Los nodos gris claro son alumnos sin implicacion en rechazos."),
          React.createElement(RejectionGraph, { nodes: soc.nodes, negativeResponses }),
          React.createElement(Text, { style: { fontSize: 8, color: "#64748b", marginTop: 6, marginBottom: 3 } },
            "Leyenda — alumnos con mas rechazos recibidos (top 30):"),
          React.createElement(View, { style: pdfStyles.tableHeader },
            React.createElement(Text, { style: [pdfStyles.thCell, { flex: 0.5 }] }, "No"),
            React.createElement(Text, { style: [pdfStyles.thCell, { flex: 2.5 }] }, "Alumno"),
            React.createElement(Text, { style: [pdfStyles.thCell, { flex: 1 }] }, "Clase"),
            React.createElement(Text, { style: [pdfStyles.thCell, { flex: 1 }] }, "Rechazos rcb."),
            React.createElement(Text, { style: [pdfStyles.thCell, { flex: 1.2 }] }, "Perfil CDC"),
          ),
          ...[...positions]
            .sort((a, b) => (b.node.rejection_received_count ?? 0) - (a.node.rejection_received_count ?? 0))
            .filter(p => (p.node.rejection_received_count ?? 0) > 0)
            .slice(0, 30)
            .map(p =>
              React.createElement(View, { key: p.node.id, style: pdfStyles.tableRow },
                React.createElement(Text, { style: [pdfStyles.tdCell, { flex: 0.5 }] }, String(p.index)),
                React.createElement(Text, { style: [pdfStyles.tdCell, { flex: 2.5 }] }, p.node.label),
                React.createElement(Text, { style: [pdfStyles.tdCell, { flex: 1 }] }, p.node.current_class ?? "—"),
                React.createElement(Text, { style: [pdfStyles.tdCell, { flex: 1 }] }, String(p.node.rejection_received_count ?? 0)),
                React.createElement(Text, { style: [pdfStyles.tdCell, { flex: 1.2 }] }, p.node.sociometric_status ?? "—"),
              )
            ),
          React.createElement(View, { style: pdfStyles.footer, fixed: true },
            React.createElement(Text, { style: pdfStyles.footerText }, "ClassMixer · Informe de orientacion — confidencial, no distribuir"),
            React.createElement(Text, { style: pdfStyles.footerText, render: ({ pageNumber, totalPages }: any) => `Pag. ${pageNumber} / ${totalPages}` }),
          ),
        )
      : null,
  )
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile || !hasFullAccess(profile.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const { id } = await params
  const supabase = createServiceClient()

  const { data: process } = await supabase
    .from("processes")
    .select("*")
    .eq("id", id)
    .eq("center_id", profile.center_id)
    .single()

  if (!process) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  const [{ data: students }, { data: responses }, { data: rules }, { data: centerData }] = await Promise.all([
    supabase.from("students").select("*").eq("process_id", id).eq("active", true),
    supabase.from("responses").select("*").eq("process_id", id),
    supabase.from("rules")
      .select("*, rule_students(student_id, students(first_name, last_name))")
      .eq("process_id", id)
      .eq("active", true)
      .eq("rule_type", "must_separate"),
    supabase.from("centers").select("logo_url").eq("id", profile.center_id).single(),
  ])
  const logoUrl = (centerData as any)?.logo_url as string | null | undefined

  if (!students) return NextResponse.json({ error: "Error al cargar alumnos" }, { status: 500 })

  const activeStudents = (students as any[]).filter(s => !s.excluded_from_mix)
  const studentMap = new Map(activeStudents.map((s: any) => [s.id, s]))
  const excludedIds = new Set((students as any[]).filter(s => s.excluded_from_mix).map(s => s.id))
  const scopedResponses = (responses ?? []).filter(
    (r: any) => !excludedIds.has(r.respondent_student_id) && !excludedIds.has(r.target_student_id)
  )

  const catalogIndex = await getQuestionCatalogIndex(profile.center_id)
  const negativeLike: string[] = catalogIndex.scoringRoles.negativeLike ?? ["negative"]

  const soc = calculateSociogram(
    activeStudents as any,
    scopedResponses as any,
    catalogIndex.scoringRoles.friendshipLike,
    catalogIndex.excludedFromGraph,
    negativeLike,
  )

  // Formal separation rules (admin-configured constraints) — separate concept from questionnaire data
  const separationRules: string[] = []
  for (const r of (rules ?? []) as any[]) {
    const names = (r.rule_students ?? []).map((rs: any) =>
      rs.students ? `${rs.students.first_name} ${rs.students.last_name}` : rs.student_id
    )
    separationRules.push(
      r.description
        ? `${r.description} (${names.join(", ")})`
        : `Separacion obligatoria: ${names.join(", ")}`
    )
  }

  // Raw negative questionnaire nominations (NOT the same as formal rules)
  const negativeResponses = (scopedResponses as any[]).filter(r => negativeLike.includes(r.relation_type))
  const negativeNominationsTotal = negativeResponses.length

  const buffer = await renderToBuffer(
    React.createElement(OrientacionPDF, {
      process,
      soc,
      studentMap,
      separationRules,
      negativeNominationsTotal,
      negativeResponses,
      logoUrl,
    }) as any
  )

  await logAudit(profile.id, profile.center_id, "export_informe_orientacion", "process", {
    processId: id,
    metadata: {
      isolated: soc.metrics.isolated_count,
      vulnerable: soc.metrics.vulnerable_count,
      rejected: soc.metrics.rejected_count,
      controversial: soc.metrics.controversial_count,
      bullying_risk: soc.nodes.filter(n => n.sociometric_status === "rechazado" && (n.rejection_received_count ?? 0) >= 5).length,
    },
  })

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=informe-orientacion.pdf",
    },
  })
}
