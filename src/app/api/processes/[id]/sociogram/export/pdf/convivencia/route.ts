/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, hasFullAccess, logAudit } from "@/lib/auth"
import { NextResponse } from "next/server"
import React from "react"
import { Document, Page, Text, View, renderToBuffer } from "@react-pdf/renderer"
import { pdfStyles, formatDate, ALERT_STYLE_BY_SEVERITY, PdfLogoRow } from "@/lib/pdf/shared"

const FLAG_THRESHOLD = 2

interface StudentLite {
  id: string
  first_name: string
  last_name: string
  current_class: string
}

interface CategorySummary {
  code: string
  label: string
  total: number
  topMentions: { student: StudentLite | undefined; count: number }[]
  frequencyBreakdown: { frequency: string; count: number }[]
}

function nameOf(s: StudentLite | undefined): string {
  return s ? `${s.first_name} ${s.last_name} (${s.current_class})` : "Alumno desconocido"
}

function ConvivenciaPDF({ process, categories, flagged, totalResponses, logoUrl }: {
  process: any
  categories: CategorySummary[]
  flagged: { student: StudentLite | undefined; signals: number }[]
  totalResponses: number
  logoUrl?: string | null
}) {
  return React.createElement(Document, null,
    React.createElement(Page, { size: "A4", style: pdfStyles.page },
      React.createElement(PdfLogoRow, { logoUrl }),
      React.createElement(View, { style: pdfStyles.header },
        React.createElement(Text, { style: pdfStyles.title }, "Informe de convivencia"),
        React.createElement(Text, { style: pdfStyles.subtitle }, `${process.name} · ${process.school_year} · ${formatDate()}`),
        React.createElement(View, { style: pdfStyles.metaRow },
          React.createElement(View, { style: pdfStyles.confidentialBadge }, React.createElement(Text, null, "Muy sensible — solo orientación y administración, acceso registrado")),
        ),
      ),

      React.createElement(Text, { style: { fontSize: 9, color: "#64748b", marginBottom: 12, lineHeight: 1.4 } },
        "Este informe agrupa señales recogidas en el cuestionario sociométrico sobre posibles situaciones de convivencia. " +
        "Son indicios para apoyar la revisión profesional del equipo de orientación y tutoría, no un diagnóstico ni una acusación. " +
        "Cualquier decisión debe tomarse considerando el contexto completo del alumno y mediante observación directa."
      ),

      React.createElement(Text, { style: pdfStyles.sectionTitle }, "Resumen"),
      React.createElement(View, { style: pdfStyles.summaryGrid },
        React.createElement(View, { style: pdfStyles.summaryCard },
          React.createElement(Text, { style: pdfStyles.summaryValue }, String(totalResponses)),
          React.createElement(Text, { style: pdfStyles.summaryLabel }, "Señales registradas")),
        React.createElement(View, { style: pdfStyles.summaryCard },
          React.createElement(Text, { style: pdfStyles.summaryValue }, String(flagged.length)),
          React.createElement(Text, { style: pdfStyles.summaryLabel }, `Alumnos con ${FLAG_THRESHOLD}+ menciones`)),
        ...categories.map(c =>
          React.createElement(View, { key: c.code, style: pdfStyles.summaryCard },
            React.createElement(Text, { style: pdfStyles.summaryValue }, String(c.total)),
            React.createElement(Text, { style: pdfStyles.summaryLabel }, c.label))
        ),
      ),

      React.createElement(Text, { style: pdfStyles.sectionTitle }, "Alumnos a revisar"),
      flagged.length > 0
        ? React.createElement(View, null, ...flagged.map((f, i) =>
            React.createElement(View, { key: i, style: ALERT_STYLE_BY_SEVERITY.high },
              React.createElement(Text, { style: pdfStyles.alertText },
                `${nameOf(f.student)} — mencionado(a) en ${f.signals} señal(es) de convivencia. Recomendable observación directa y contraste con tutoría.`))
          ))
        : React.createElement(Text, { style: { fontSize: 9, color: "#64748b" } }, "Ningún alumno supera el umbral de revisión prioritaria."),

      ...categories.flatMap(c => [
        React.createElement(Text, { key: `${c.code}-title`, style: pdfStyles.sectionTitle }, c.label),
        c.topMentions.length > 0
          ? React.createElement(View, { key: `${c.code}-list` }, ...c.topMentions.map((m, i) =>
              React.createElement(View, { key: i, style: ALERT_STYLE_BY_SEVERITY.medium },
                React.createElement(Text, { style: pdfStyles.alertText }, `${nameOf(m.student)} — ${m.count} mención(es)`))
            ))
          : React.createElement(Text, { key: `${c.code}-empty`, style: { fontSize: 9, color: "#64748b" } }, "Sin señales registradas para esta categoría."),
        ...(c.frequencyBreakdown.length > 0
          ? [React.createElement(Text, { key: `${c.code}-freq`, style: { fontSize: 8, color: "#64748b", marginTop: 4 } },
              `Frecuencia indicada: ${c.frequencyBreakdown.map(f => `${f.frequency} (${f.count})`).join(", ")}`)]
          : []),
      ]),

      React.createElement(View, { style: pdfStyles.footer, fixed: true },
        React.createElement(Text, { style: pdfStyles.footerText }, "ClassMixer · Informe de convivencia — muy confidencial, no distribuir"),
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

  const { data: bullyingTypes } = await supabase
    .from("question_types")
    .select("code, label")
    .eq("category", "bullying")
    .eq("active", true)
    .or(`center_id.is.null,center_id.eq.${profile.center_id}`)

  const codes = (bullyingTypes ?? []).map((t: any) => t.code as string)

  const [{ data: students }, { data: responsesRaw }, { data: centerData }] = await Promise.all([
    supabase.from("students").select("id, first_name, last_name, current_class").eq("process_id", id).eq("active", true),
    codes.length > 0
      ? (supabase as any)
          .from("responses")
          .select("respondent_student_id, target_student_id, relation_type, metadata")
          .eq("process_id", id)
          .in("relation_type", codes)
      : Promise.resolve({ data: [] as any[] }),
    supabase.from("centers").select("logo_url").eq("id", profile.center_id).single(),
  ])
  const logoUrl = (centerData as any)?.logo_url as string | null | undefined

  const studentMap = new Map((students as StudentLite[] ?? []).map(s => [s.id, s]))
  const responses = (responsesRaw as any[]) ?? []

  const signalsByStudent = new Map<string, number>()
  const categories: CategorySummary[] = (bullyingTypes ?? []).map((t: any) => {
    const ofType = responses.filter(r => r.relation_type === t.code)

    const countByTarget = new Map<string, number>()
    const freqCount = new Map<string, number>()
    for (const r of ofType) {
      countByTarget.set(r.target_student_id, (countByTarget.get(r.target_student_id) ?? 0) + 1)
      signalsByStudent.set(r.target_student_id, (signalsByStudent.get(r.target_student_id) ?? 0) + 1)
      const freq = r.metadata?.frequency
      if (typeof freq === "string" && freq) freqCount.set(freq, (freqCount.get(freq) ?? 0) + 1)
    }

    const topMentions = [...countByTarget.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([studentId, count]) => ({ student: studentMap.get(studentId), count }))

    return {
      code: t.code,
      label: t.label,
      total: ofType.length,
      topMentions,
      frequencyBreakdown: [...freqCount.entries()].map(([frequency, count]) => ({ frequency, count })),
    }
  })

  const flagged = [...signalsByStudent.entries()]
    .filter(([, count]) => count >= FLAG_THRESHOLD)
    .sort((a, b) => b[1] - a[1])
    .map(([studentId, signals]) => ({ student: studentMap.get(studentId), signals }))

  const buffer = await renderToBuffer(
    React.createElement(ConvivenciaPDF, { process, categories, flagged, totalResponses: responses.length, logoUrl }) as any
  )

  await logAudit(profile.id, profile.center_id, "export_informe_convivencia", "process", {
    processId: id,
    metadata: { total_responses: responses.length, flagged_count: flagged.length },
  })

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=informe-convivencia.pdf",
    },
  })
}
