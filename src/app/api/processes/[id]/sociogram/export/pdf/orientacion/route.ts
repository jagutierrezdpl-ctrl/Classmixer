/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, hasFullAccess, logAudit } from "@/lib/auth"
import { NextResponse } from "next/server"
import React from "react"
import { Document, Page, Text, View, renderToBuffer } from "@react-pdf/renderer"
import { calculateSociogram } from "@/lib/sociogram/calculate"
import { pdfStyles, formatDate, ALERT_STYLE_BY_SEVERITY, PdfLogoRow } from "@/lib/pdf/shared"
import { getQuestionCatalogIndex } from "@/lib/questionnaire/catalog"

function nameOf(s: any): string {
  return s ? `${s.first_name} ${s.last_name}` : "Alumno desconocido"
}

function OrientacionPDF({ process, soc, studentMap, separationRules, negativeNominationsTotal, logoUrl }: {
  process: any
  soc: ReturnType<typeof calculateSociogram>
  studentMap: Map<string, any>
  separationRules: string[]    // Formal admin rules (must_separate)
  negativeNominationsTotal: number  // Raw questionnaire negative choices
  logoUrl?: string | null
}) {
  const isolated       = soc.nodes.filter(n => n.is_isolated)
  const vulnerable     = soc.nodes.filter(n => n.is_vulnerable && !n.is_isolated)
  const rejected       = [...soc.nodes].filter(n => n.sociometric_status === "rechazado")
    .sort((a, b) => (b.rejection_received_count ?? 0) - (a.rejection_received_count ?? 0))
  const controversial  = [...soc.nodes].filter(n => n.sociometric_status === "controvertido")
    .sort((a, b) => (b.rejection_received_count ?? 0) - (a.rejection_received_count ?? 0))
  const closedGroups   = soc.communities.filter(c => c.is_closed)
  const hasRejData     = soc.metrics.has_rejection_data

  return React.createElement(Document, null,

    // ── Página 1: Resumen y perfiles de riesgo ─────────────────────────────
    React.createElement(Page, { size: "A4", style: pdfStyles.page },
      React.createElement(PdfLogoRow, { logoUrl }),
      React.createElement(View, { style: pdfStyles.header },
        React.createElement(Text, { style: pdfStyles.title }, "Informe para orientación"),
        React.createElement(Text, { style: pdfStyles.subtitle }, `${process.name} · ${process.school_year} · ${formatDate()}`),
        React.createElement(View, { style: pdfStyles.metaRow },
          React.createElement(View, { style: pdfStyles.confidentialBadge },
            React.createElement(Text, null, "Datos sensibles — acceso restringido y registrado")),
        ),
      ),

      React.createElement(Text, { style: pdfStyles.sectionTitle }, "Resumen sociométrico"),
      React.createElement(View, { style: pdfStyles.summaryGrid },
        React.createElement(View, { style: pdfStyles.summaryCard },
          React.createElement(Text, { style: pdfStyles.summaryValue }, String(isolated.length)),
          React.createElement(Text, { style: pdfStyles.summaryLabel }, "Aislamiento total (0 votos)")),
        React.createElement(View, { style: pdfStyles.summaryCard },
          React.createElement(Text, { style: pdfStyles.summaryValue }, String(vulnerable.length)),
          React.createElement(Text, { style: pdfStyles.summaryLabel }, "Posición social frágil")),
        React.createElement(View, { style: pdfStyles.summaryCard },
          React.createElement(Text, { style: pdfStyles.summaryValue }, String(rejected.length)),
          React.createElement(Text, { style: pdfStyles.summaryLabel }, "Rechazados CDC")),
        React.createElement(View, { style: pdfStyles.summaryCard },
          React.createElement(Text, { style: pdfStyles.summaryValue }, String(controversial.length)),
          React.createElement(Text, { style: pdfStyles.summaryLabel }, "Controvertidos CDC")),
        React.createElement(View, { style: pdfStyles.summaryCard },
          React.createElement(Text, { style: pdfStyles.summaryValue }, String(separationRules.length)),
          React.createElement(Text, { style: pdfStyles.summaryLabel }, "Reglas de separación activas")),
        React.createElement(View, { style: pdfStyles.summaryCard },
          React.createElement(Text, { style: pdfStyles.summaryValue }, String(negativeNominationsTotal)),
          React.createElement(Text, { style: pdfStyles.summaryLabel }, "Nominaciones negativas totales")),
      ),

      // ── CDC: Rechazados ──────────────────────────────────────────────────
      React.createElement(Text, { style: pdfStyles.sectionTitle }, "Perfiles de riesgo — Rechazados (CDC)"),
      !hasRejData
        ? React.createElement(Text, { style: { fontSize: 9, color: "#64748b" } }, "No hay datos de elecciones negativas en este proceso. La clasificación CDC completa requiere que el cuestionario incluya la pregunta de dificultad relacional.")
        : rejected.length > 0
          ? React.createElement(View, null, ...rejected.map(n =>
              React.createElement(View, { key: n.id, style: ALERT_STYLE_BY_SEVERITY.high },
                React.createElement(Text, { style: pdfStyles.alertText },
                  `${n.first_name} ${n.last_name} (${n.current_class}) — ` +
                  `${n.rejection_received_count ?? 0} nominacion(es) de rechazo recibidas · ` +
                  `${n.received_count} amistad(es) recibida(s) · ` +
                  `${n.reciprocal_count} relación(es) recíproca(s). ` +
                  `Riesgo de exclusión activa. Revisión prioritaria recomendada.`))
            ))
          : React.createElement(Text, { style: { fontSize: 9, color: "#64748b" } }, "No se han detectado alumnos con perfil de rechazo activo (CDC)."),

      // ── CDC: Controvertidos ──────────────────────────────────────────────
      controversial.length > 0
        ? React.createElement(View, null,
            React.createElement(Text, { style: pdfStyles.sectionTitle }, "Perfiles de riesgo — Controvertidos (CDC)"),
            ...controversial.map(n =>
              React.createElement(View, { key: n.id, style: ALERT_STYLE_BY_SEVERITY.medium },
                React.createElement(Text, { style: pdfStyles.alertText },
                  `${n.first_name} ${n.last_name} (${n.current_class}) — ` +
                  `${n.received_count} voto(s) de amistad · ` +
                  `${n.rejection_received_count ?? 0} nominacion(es) de rechazo. ` +
                  `Alta visibilidad social con rechazo significativo (controvertido CDC).`))
          ))
        : null,

      // ── Aislamiento total ────────────────────────────────────────────────
      React.createElement(Text, { style: pdfStyles.sectionTitle }, "Alumnos en aislamiento total (0 votos recibidos)"),
      isolated.length > 0
        ? React.createElement(View, null, ...isolated.map(n =>
            React.createElement(View, { key: n.id, style: ALERT_STYLE_BY_SEVERITY.high },
              React.createElement(Text, { style: pdfStyles.alertText },
                `${n.first_name} ${n.last_name} (${n.current_class}) — ` +
                `0 elecciones de amistad recibidas · ${n.given_count} emitidas. ` +
                `Perfil CDC: ${n.sociometric_status ?? "no clasificado"}.`))
          ))
        : React.createElement(Text, { style: { fontSize: 9, color: "#64748b" } }, "No se han detectado alumnos en aislamiento total."),

      React.createElement(View, { style: pdfStyles.footer, fixed: true },
        React.createElement(Text, { style: pdfStyles.footerText }, "ClassMixer · Informe de orientación — confidencial, no distribuir"),
        React.createElement(Text, { style: pdfStyles.footerText, render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `Pág. ${pageNumber} / ${totalPages}` }),
      )
    ),

    // ── Página 2: Posición frágil, subgrupos, reglas ───────────────────────
    React.createElement(Page, { size: "A4", style: pdfStyles.page },

      React.createElement(Text, { style: pdfStyles.sectionTitle }, "Alumnos en posición social frágil (dependencia de un único vínculo)"),
      vulnerable.length > 0
        ? React.createElement(View, null, ...vulnerable.map(n =>
            React.createElement(View, { key: n.id, style: ALERT_STYLE_BY_SEVERITY.medium },
              React.createElement(Text, { style: pdfStyles.alertText },
                `${n.first_name} ${n.last_name} (${n.current_class}) — ` +
                `${n.received_count} voto(s) recibido(s) · ${n.reciprocal_count} relación(es) recíproca(s). ` +
                `Si se separa de su único vínculo al mezclar clases, quedará sin conexiones.`))
          ))
        : React.createElement(Text, { style: { fontSize: 9, color: "#64748b" } }, "No se han detectado alumnos en situación de dependencia única."),

      React.createElement(Text, { style: pdfStyles.sectionTitle }, "Subgrupos cerrados detectados"),
      closedGroups.length > 0
        ? React.createElement(View, null, ...closedGroups.map(g =>
            React.createElement(View, { key: g.id, style: ALERT_STYLE_BY_SEVERITY.medium },
              React.createElement(Text, { style: pdfStyles.alertText },
                `Subgrupo cerrado de ${g.size} alumnos: ${g.members.map(id => nameOf(studentMap.get(id))).join(", ")}`))
          ))
        : React.createElement(Text, { style: { fontSize: 9, color: "#64748b" } }, "No se han detectado subgrupos cerrados."),

      React.createElement(Text, { style: pdfStyles.sectionTitle }, "Reglas de separación activas (configuradas por el equipo)"),
      separationRules.length > 0
        ? React.createElement(View, null, ...separationRules.map((c, i) =>
            React.createElement(View, { key: i, style: ALERT_STYLE_BY_SEVERITY.high },
              React.createElement(Text, { style: pdfStyles.alertText }, c))
          ))
        : React.createElement(Text, { style: { fontSize: 9, color: "#64748b" } }, "No hay reglas de separación obligatoria configuradas para este proceso."),

      negativeNominationsTotal > 0
        ? React.createElement(View, { style: { marginTop: 10 } },
            React.createElement(Text, { style: pdfStyles.sectionTitle }, "Nominaciones negativas (elecciones de dificultad relacional)"),
            React.createElement(View, { style: ALERT_STYLE_BY_SEVERITY.medium },
              React.createElement(Text, { style: pdfStyles.alertText },
                `Total de nominaciones negativas emitidas en el cuestionario: ${negativeNominationsTotal}. ` +
                `Estas no representan un único "conflicto" sino una red de tensión entre alumnos. ` +
                `Consultar la tabla de perfiles rechazados (CDC) en la página anterior para identificar a los más afectados.`))
          )
        : null,

      React.createElement(Text, { style: pdfStyles.sectionTitle }, "Recomendaciones para orientación"),
      ...[
        isolated.length > 0 ? "Revisar individualmente a los alumnos en aislamiento total antes de confirmar cualquier mezcla de clases." : null,
        rejected.length > 0 ? `Atención prioritaria a los ${rejected.length} alumno(s) con perfil CDC "rechazado": son los de mayor riesgo de exclusión activa y eventual acoso.` : null,
        controversial.length > 0 ? `Los alumnos "controvertidos" CDC generan polarización grupal — considerar ubicarlos en clases distintas.` : null,
        vulnerable.length > 0 ? "Intentar mantener al menos una relación recíproca para los alumnos en posición frágil al generar las nuevas clases." : null,
        closedGroups.length > 0 ? "Considerar repartir los subgrupos cerrados entre varias clases para favorecer la integración social." : null,
        separationRules.length > 0 ? "Verificar que las reglas de separación obligatoria estén activas antes de ejecutar el algoritmo de mezcla." : null,
        "Si el cuestionario no incluye la pregunta de dificultad relacional, activarla en el próximo proceso para obtener la clasificación CDC completa.",
      ].filter(Boolean).map((r, i) =>
        React.createElement(Text, { key: i, style: { fontSize: 9, marginBottom: 4 } }, `· ${r}`)
      ),

      React.createElement(View, { style: pdfStyles.footer, fixed: true },
        React.createElement(Text, { style: pdfStyles.footerText }, "ClassMixer · Informe de orientación — confidencial, no distribuir"),
        React.createElement(Text, { style: pdfStyles.footerText, render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `Pág. ${pageNumber} / ${totalPages}` }),
      )
    )
  )
}

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
  const negativeLike = catalogIndex.scoringRoles.negativeLike ?? ["negative"]
  const soc = calculateSociogram(
    activeStudents as any,
    scopedResponses as any,
    catalogIndex.scoringRoles.friendshipLike,
    catalogIndex.excludedFromGraph,
    negativeLike,
  )

  // Formal separation rules (explicit admin-configured constraints)
  const separationRules: string[] = []
  for (const r of (rules ?? []) as any[]) {
    const names = (r.rule_students ?? []).map((rs: any) =>
      rs.students ? `${rs.students.first_name} ${rs.students.last_name}` : rs.student_id
    )
    separationRules.push(
      r.description
        ? `${r.description} (${names.join(", ")})`
        : `Separación obligatoria: ${names.join(", ")}`
    )
  }

  // Raw negative questionnaire nominations — separate concept from rules
  const negativeNominationsTotal = scopedResponses.filter(
    (r: any) => negativeLike.includes(r.relation_type)
  ).length

  const buffer = await renderToBuffer(
    React.createElement(OrientacionPDF, {
      process,
      soc,
      studentMap,
      separationRules,
      negativeNominationsTotal,
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
    },
  })

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=informe-orientacion.pdf",
    },
  })
}
