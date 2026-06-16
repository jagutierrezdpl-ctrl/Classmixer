/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, hasFullAccess, logAudit } from "@/lib/auth"
import { NextResponse } from "next/server"
import React from "react"
import { Document, Page, Text, View, renderToBuffer } from "@react-pdf/renderer"
import { calculateSociogram } from "@/lib/sociogram/calculate"
import { pdfStyles, formatDate, ALERT_STYLE_BY_SEVERITY } from "@/lib/pdf/shared"

function nameOf(s: any): string {
  return s ? `${s.first_name} ${s.last_name}` : "Alumno desconocido"
}

function OrientacionPDF({ process, soc, studentMap, conflicts, recommendations }: {
  process: any
  soc: ReturnType<typeof calculateSociogram>
  studentMap: Map<string, any>
  conflicts: string[]
  recommendations: string[]
}) {
  const vulnerable = soc.nodes.filter(n => n.is_vulnerable)
  const isolated = soc.nodes.filter(n => n.is_isolated)
  const closedGroups = soc.communities.filter(c => c.is_closed)

  return React.createElement(Document, null,
    React.createElement(Page, { size: "A4", style: pdfStyles.page },
      React.createElement(View, { style: pdfStyles.header },
        React.createElement(Text, { style: pdfStyles.title }, "Informe para orientación"),
        React.createElement(Text, { style: pdfStyles.subtitle }, `${process.name} · ${process.school_year} · ${formatDate()}`),
        React.createElement(View, { style: pdfStyles.metaRow },
          React.createElement(View, { style: pdfStyles.confidentialBadge }, React.createElement(Text, null, "Datos sensibles — acceso restringido y registrado")),
        ),
      ),

      React.createElement(Text, { style: pdfStyles.sectionTitle }, "Resumen"),
      React.createElement(View, { style: pdfStyles.summaryGrid },
        React.createElement(View, { style: pdfStyles.summaryCard },
          React.createElement(Text, { style: pdfStyles.summaryValue }, String(isolated.length)),
          React.createElement(Text, { style: pdfStyles.summaryLabel }, "Alumnos aislados")),
        React.createElement(View, { style: pdfStyles.summaryCard },
          React.createElement(Text, { style: pdfStyles.summaryValue }, String(vulnerable.length)),
          React.createElement(Text, { style: pdfStyles.summaryLabel }, "Alumnos vulnerables")),
        React.createElement(View, { style: pdfStyles.summaryCard },
          React.createElement(Text, { style: pdfStyles.summaryValue }, String(closedGroups.length)),
          React.createElement(Text, { style: pdfStyles.summaryLabel }, "Subgrupos cerrados")),
        React.createElement(View, { style: pdfStyles.summaryCard },
          React.createElement(Text, { style: pdfStyles.summaryValue }, String(conflicts.length)),
          React.createElement(Text, { style: pdfStyles.summaryLabel }, "Conflictos registrados")),
      ),

      React.createElement(Text, { style: pdfStyles.sectionTitle }, "Alumnos aislados"),
      isolated.length > 0
        ? React.createElement(View, null, ...isolated.map(n =>
            React.createElement(View, { key: n.id, style: ALERT_STYLE_BY_SEVERITY.high },
              React.createElement(Text, { style: pdfStyles.alertText }, `${n.first_name} ${n.last_name} (${n.current_class}) — sin elecciones recibidas ni relaciones recíprocas`))
          ))
        : React.createElement(Text, { style: { fontSize: 9, color: "#64748b" } }, "No se han detectado alumnos aislados."),

      React.createElement(Text, { style: pdfStyles.sectionTitle }, "Alumnos vulnerables y relaciones de dependencia"),
      vulnerable.length > 0
        ? React.createElement(View, null, ...vulnerable.map(n =>
            React.createElement(View, { key: n.id, style: ALERT_STYLE_BY_SEVERITY.medium },
              React.createElement(Text, { style: pdfStyles.alertText },
                `${n.first_name} ${n.last_name} (${n.current_class}) — depende de una única relación recíproca; riesgo de aislamiento si se separa de su vínculo`))
          ))
        : React.createElement(Text, { style: { fontSize: 9, color: "#64748b" } }, "No se han detectado alumnos en situación de dependencia única."),

      React.createElement(Text, { style: pdfStyles.sectionTitle }, "Conflictos"),
      conflicts.length > 0
        ? React.createElement(View, null, ...conflicts.map((c, i) =>
            React.createElement(View, { key: i, style: ALERT_STYLE_BY_SEVERITY.high },
              React.createElement(Text, { style: pdfStyles.alertText }, c))
          ))
        : React.createElement(Text, { style: { fontSize: 9, color: "#64748b" } }, "No hay conflictos registrados para este proceso."),

      React.createElement(Text, { style: pdfStyles.sectionTitle }, "Subgrupos detectados"),
      closedGroups.length > 0
        ? React.createElement(View, null, ...closedGroups.map(g =>
            React.createElement(View, { key: g.id, style: ALERT_STYLE_BY_SEVERITY.medium },
              React.createElement(Text, { style: pdfStyles.alertText },
                `Subgrupo cerrado de ${g.size} alumnos: ${g.members.map(id => nameOf(studentMap.get(id))).join(", ")}`))
          ))
        : React.createElement(Text, { style: { fontSize: 9, color: "#64748b" } }, "No se han detectado subgrupos cerrados."),

      React.createElement(Text, { style: pdfStyles.sectionTitle }, "Recomendaciones"),
      ...recommendations.map((r, i) =>
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

  const [{ data: students }, { data: responses }, { data: rules }] = await Promise.all([
    supabase.from("students").select("*").eq("process_id", id).eq("active", true),
    supabase.from("responses").select("*").eq("process_id", id),
    supabase.from("rules").select("*, rule_students(student_id, students(first_name, last_name))").eq("process_id", id).eq("active", true).eq("rule_type", "must_separate"),
  ])

  if (!students) return NextResponse.json({ error: "Error al cargar alumnos" }, { status: 500 })

  const activeStudents = (students as any[]).filter(s => !s.excluded_from_mix)
  const studentMap = new Map(activeStudents.map((s: any) => [s.id, s]))
  const excludedIds = new Set((students as any[]).filter(s => s.excluded_from_mix).map(s => s.id))
  const scopedResponses = (responses ?? []).filter((r: any) => !excludedIds.has(r.respondent_student_id) && !excludedIds.has(r.target_student_id))
  const soc = calculateSociogram(activeStudents as any, scopedResponses as any)

  const conflicts: string[] = []
  for (const r of (rules ?? []) as any[]) {
    const names = (r.rule_students ?? []).map((rs: any) => rs.students ? `${rs.students.first_name} ${rs.students.last_name}` : rs.student_id)
    conflicts.push(r.description ? `${r.description} (${names.join(", ")})` : `Separación obligatoria: ${names.join(", ")}`)
  }
  const negativeCount = (responses ?? []).filter((r: any) => r.relation_type === "negative").length
  if (negativeCount > 0) conflicts.push(`${negativeCount} elección(es) negativa(s) registradas en el cuestionario`)

  const recommendations: string[] = []
  if (soc.nodes.some(n => n.is_isolated)) recommendations.push("Revisar individualmente a los alumnos aislados antes de confirmar cualquier mezcla de clases.")
  if (soc.nodes.some(n => n.is_vulnerable)) recommendations.push("Intentar mantener al menos una relación recíproca para los alumnos vulnerables al generar las nuevas clases.")
  if (soc.communities.some(c => c.is_closed)) recommendations.push("Considerar repartir los subgrupos cerrados entre varias clases para favorecer la integración.")
  if (conflicts.length > 0) recommendations.push("Verificar que las reglas de separación obligatoria estén activas antes de ejecutar el algoritmo.")
  if (recommendations.length === 0) recommendations.push("No se han detectado riesgos sociales relevantes en este grupo.")

  const buffer = await renderToBuffer(React.createElement(OrientacionPDF, { process, soc, studentMap, conflicts, recommendations }) as any)

  await logAudit(profile.id, profile.center_id, "export_informe_orientacion", "process", {
    processId: id,
    metadata: { isolated: soc.metrics.isolated_count, vulnerable: soc.metrics.vulnerable_count },
  })

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=informe-orientacion.pdf",
    },
  })
}
