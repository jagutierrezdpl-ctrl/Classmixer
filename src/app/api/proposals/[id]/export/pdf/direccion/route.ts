/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, logAudit } from "@/lib/auth"
import { NextResponse } from "next/server"
import React from "react"
import { Document, Page, Text, View, renderToBuffer } from "@react-pdf/renderer"
import { pdfStyles, formatDate, PdfLogoRow } from "@/lib/pdf/shared"

const STATUS_LABEL: Record<string, string> = {
  generada: "Generada",
  editada: "Editada manualmente",
  aprobada: "Aprobada",
  descartada: "Descartada",
}

const RULE_TYPE_LABELS: Record<string, string> = {
  must_separate: "Separar obligatoriamente",
  should_keep_together: "Mantener juntos (recomendado)",
  must_keep_together: "Mantener juntos (obligatorio)",
  keep_at_least_one: "Mantener al menos uno",
  max_from_group: "Máximo por clase",
  lock_student_to_class: "Fijar en clase concreta",
  with_tutor: "Asignar con tutor concreto",
  exclude_student: "Excluir de la mezcla",
  protect_vulnerable: "Proteger alumno vulnerable",
  avoid_tutor: "Evitar tutor (alumno-tutor)",
}

function DireccionPDF({ process, proposal, classesList, ruleCounts, logoUrl }: {
  process: any
  proposal: any
  classesList: Array<{ name: string; students: any[]; metrics: Record<string, number> }>
  ruleCounts: Record<string, number>
  logoUrl?: string | null
}) {
  const totalStudents = classesList.reduce((s, c) => s + c.students.length, 0)

  return React.createElement(Document, null,
    React.createElement(Page, { size: "A4", style: pdfStyles.page },
      React.createElement(PdfLogoRow, { logoUrl }),
      React.createElement(View, { style: pdfStyles.header },
        React.createElement(Text, { style: pdfStyles.title }, "Informe para dirección"),
        React.createElement(Text, { style: pdfStyles.subtitle }, `${process.name} · ${process.school_year} · ${formatDate()}`),
        React.createElement(View, { style: pdfStyles.metaRow },
          React.createElement(View, { style: pdfStyles.metaBadge }, React.createElement(Text, null, `Propuesta: ${proposal.name}`)),
          React.createElement(View, { style: pdfStyles.metaBadge }, React.createElement(Text, null, STATUS_LABEL[proposal.status] ?? proposal.status)),
        ),
      ),

      React.createElement(Text, { style: pdfStyles.sectionTitle }, "Resumen ejecutivo"),
      React.createElement(View, { style: pdfStyles.summaryGrid },
        React.createElement(View, { style: pdfStyles.summaryCard },
          React.createElement(Text, { style: pdfStyles.summaryValue }, String(totalStudents)),
          React.createElement(Text, { style: pdfStyles.summaryLabel }, "Alumnos totales")),
        React.createElement(View, { style: pdfStyles.summaryCard },
          React.createElement(Text, { style: pdfStyles.summaryValue }, String(classesList.length)),
          React.createElement(Text, { style: pdfStyles.summaryLabel }, "Clases destino")),
        React.createElement(View, { style: pdfStyles.summaryCard },
          React.createElement(Text, { style: pdfStyles.summaryValue }, `${(proposal.score_total ?? 0).toFixed(0)}/100`),
          React.createElement(Text, { style: pdfStyles.summaryLabel }, "Puntuación global")),
      ),

      React.createElement(Text, { style: pdfStyles.sectionTitle }, "Equilibrio final"),
      React.createElement(View, { style: pdfStyles.summaryGrid },
        React.createElement(View, { style: pdfStyles.summaryCard },
          React.createElement(Text, { style: pdfStyles.summaryValue }, `${(proposal.score_social ?? 0).toFixed(0)}`),
          React.createElement(Text, { style: pdfStyles.summaryLabel }, "Social")),
        React.createElement(View, { style: pdfStyles.summaryCard },
          React.createElement(Text, { style: pdfStyles.summaryValue }, `${(proposal.score_academic ?? 0).toFixed(0)}`),
          React.createElement(Text, { style: pdfStyles.summaryLabel }, "Académico")),
        React.createElement(View, { style: pdfStyles.summaryCard },
          React.createElement(Text, { style: pdfStyles.summaryValue }, `${(proposal.score_gender ?? 0).toFixed(0)}`),
          React.createElement(Text, { style: pdfStyles.summaryLabel }, "Género")),
        React.createElement(View, { style: pdfStyles.summaryCard },
          React.createElement(Text, { style: pdfStyles.summaryValue }, `${(proposal.score_behavior ?? 0).toFixed(0)}`),
          React.createElement(Text, { style: pdfStyles.summaryLabel }, "Convivencia")),
      ),

      React.createElement(Text, { style: pdfStyles.sectionTitle }, "Criterios aplicados"),
      Object.keys(ruleCounts).length > 0
        ? React.createElement(View, null, ...Object.entries(ruleCounts).map(([type, count]) =>
            React.createElement(Text, { key: type, style: { fontSize: 9, marginBottom: 3 } },
              `· ${count} regla(s) de "${RULE_TYPE_LABELS[type] ?? type}"`)
          ))
        : React.createElement(Text, { style: { fontSize: 9, color: "#64748b" } }, "No se configuraron reglas para este proceso."),

      React.createElement(Text, { style: pdfStyles.sectionTitle }, "Observaciones principales por clase"),
      React.createElement(View, { style: pdfStyles.tableHeader },
        React.createElement(Text, { style: [pdfStyles.thCell, { flex: 1.2 }] }, "Clase"),
        React.createElement(Text, { style: [pdfStyles.thCell, { flex: 1 }] }, "Alumnos"),
        React.createElement(Text, { style: [pdfStyles.thCell, { flex: 1 }] }, "Nota media"),
        React.createElement(Text, { style: [pdfStyles.thCell, { flex: 1 }] }, "Género F/M"),
        React.createElement(Text, { style: [pdfStyles.thCell, { flex: 1 }] }, "Con NEE"),
        React.createElement(Text, { style: [pdfStyles.thCell, { flex: 1.2 }] }, "Seguimiento"),
      ),
      ...classesList.map(cls =>
        React.createElement(View, { key: cls.name, style: pdfStyles.tableRow },
          React.createElement(Text, { style: [pdfStyles.tdCell, { flex: 1.2 }] }, cls.name),
          React.createElement(Text, { style: [pdfStyles.tdCell, { flex: 1 }] }, String(cls.metrics.count ?? cls.students.length)),
          React.createElement(Text, { style: [pdfStyles.tdCell, { flex: 1 }] }, (cls.metrics.average_grade ?? 0).toFixed(2)),
          React.createElement(Text, { style: [pdfStyles.tdCell, { flex: 1 }] }, `${cls.metrics.female ?? 0}F / ${cls.metrics.male ?? 0}M`),
          React.createElement(Text, { style: [pdfStyles.tdCell, { flex: 1 }] }, String(cls.metrics.with_needs ?? 0)),
          React.createElement(Text, { style: [pdfStyles.tdCell, { flex: 1.2 }] }, String(cls.metrics.with_behavior_issues ?? 0)),
        )
      ),

      React.createElement(View, { style: pdfStyles.footer, fixed: true },
        React.createElement(Text, { style: pdfStyles.footerText }, "ClassMixer · Informe de dirección — uso interno"),
        React.createElement(Text, { style: pdfStyles.footerText, render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `Pág. ${pageNumber} / ${totalPages}` }),
      )
    )
  )
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile || !["admin", "superadmin"].includes(profile.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const { id } = await params
  const supabase = createServiceClient()

  const { data: proposalRaw, error } = await (supabase as any)
    .from("proposals")
    .select("*, processes!inner(id, name, school_year, center_id), proposal_assignments(*, students(*)), proposal_metrics(*)")
    .eq("id", id)
    .single()

  if (error || !proposalRaw) return NextResponse.json({ error: "No encontrada" }, { status: 404 })
  if (proposalRaw.processes?.center_id !== profile.center_id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const proposal = proposalRaw as any
  const process = proposal.processes

  const [{ data: rules }, { data: centerData }] = await Promise.all([
    supabase.from("rules").select("rule_type").eq("process_id", process.id).eq("active", true),
    supabase.from("centers").select("logo_url").eq("id", profile.center_id).single(),
  ])
  const logoUrl = (centerData as any)?.logo_url as string | null | undefined

  const ruleCounts: Record<string, number> = {}
  for (const r of (rules ?? [])) {
    ruleCounts[r.rule_type] = (ruleCounts[r.rule_type] ?? 0) + 1
  }

  const metricsMap: Record<string, Record<string, number>> = {}
  for (const m of (proposal.proposal_metrics ?? [])) {
    if (!m.target_class) continue
    if (!metricsMap[m.target_class]) metricsMap[m.target_class] = {}
    metricsMap[m.target_class][m.metric_key] = m.metric_value
  }

  const classMap = new Map<string, any[]>()
  for (const a of (proposal.proposal_assignments ?? [])) {
    if (!classMap.has(a.target_class)) classMap.set(a.target_class, [])
    if (a.students) classMap.get(a.target_class)!.push(a.students)
  }

  const classesList = [...classMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, students]) => ({ name, students, metrics: metricsMap[name] ?? {} }))

  const buffer = await renderToBuffer(React.createElement(DireccionPDF, { process, proposal, classesList, ruleCounts, logoUrl }) as any)

  await logAudit(profile.id, profile.center_id, "export_informe_direccion", "proposal", {
    processId: process.id,
    entityId: id,
  })

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="informe-direccion-${proposal.name.replace(/\s+/g, "-")}.pdf"`,
    },
  })
}
