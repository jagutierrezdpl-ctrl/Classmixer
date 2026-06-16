/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, hasFullAccess, logAudit } from "@/lib/auth"
import { NextResponse } from "next/server"
import React from "react"
import { Document, Page, Text, View, renderToBuffer } from "@react-pdf/renderer"
import { calculateSociogram } from "@/lib/sociogram/calculate"
import { pdfStyles, formatDate } from "@/lib/pdf/shared"
import { getQuestionCatalogIndex } from "@/lib/questionnaire/catalog"

const GENDER_LABEL: Record<string, string> = { F: "F", M: "M", Otro: "O", "No especificado": "?" }

function ClassPage({ process, cls, students, friendSummary }: {
  process: any
  cls: string
  students: any[]
  friendSummary: Map<string, string>
}) {
  const sorted = [...students].sort((a, b) => (a.last_name ?? "").localeCompare(b.last_name ?? ""))
  const followUp = students.filter(s => ["Seguimiento", "Conflictiva"].includes(s.behavior_level ?? ""))

  return React.createElement(Page, { size: "A4", style: pdfStyles.page },
    React.createElement(View, { style: pdfStyles.header },
      React.createElement(Text, { style: pdfStyles.title }, `Informe de tutoría — ${cls}`),
      React.createElement(Text, { style: pdfStyles.subtitle }, `${process.name} · ${process.school_year} · ${formatDate()}`),
      React.createElement(View, { style: pdfStyles.metaRow },
        React.createElement(View, { style: pdfStyles.metaBadge }, React.createElement(Text, null, `${students.length} alumnos`)),
        React.createElement(View, { style: pdfStyles.metaBadge }, React.createElement(Text, null, `${followUp.length} con seguimiento`)),
      ),
    ),

    React.createElement(Text, { style: pdfStyles.sectionTitle }, "Listado de alumnos"),
    React.createElement(View, { style: pdfStyles.tableHeader },
      React.createElement(Text, { style: [pdfStyles.thCell, { flex: 2.5 }] }, "Alumno"),
      React.createElement(Text, { style: [pdfStyles.thCell, { flex: 0.8 }] }, "Género"),
      React.createElement(Text, { style: [pdfStyles.thCell, { flex: 1 }] }, "Nivel"),
      React.createElement(Text, { style: [pdfStyles.thCell, { flex: 1 }] }, "Conducta"),
      React.createElement(Text, { style: [pdfStyles.thCell, { flex: 1 }] }, "Necesidades"),
      React.createElement(Text, { style: [pdfStyles.thCell, { flex: 2.5 }] }, "Relaciones sociales"),
    ),
    ...sorted.map(s =>
      React.createElement(View, { key: s.id, style: pdfStyles.tableRow },
        React.createElement(Text, { style: [pdfStyles.tdCell, { flex: 2.5 }] }, `${s.last_name ?? ""}, ${s.first_name ?? ""}`),
        React.createElement(Text, { style: [pdfStyles.tdCell, { flex: 0.8 }] }, GENDER_LABEL[s.gender ?? ""] ?? s.gender ?? ""),
        React.createElement(Text, { style: [pdfStyles.tdCell, { flex: 1 }] }, s.academic_level ?? "—"),
        React.createElement(Text, { style: [pdfStyles.tdCell, { flex: 1 }] }, s.behavior_level ?? "—"),
        React.createElement(Text, { style: [pdfStyles.tdCell, { flex: 1 }] }, s.needs_type && s.needs_type !== "No" ? s.needs_type : "No"),
        React.createElement(Text, { style: [pdfStyles.tdCell, { flex: 2.5 }] }, friendSummary.get(s.id) ?? "Sin datos"),
      )
    ),

    React.createElement(Text, { style: pdfStyles.sectionTitle }, "Observaciones internas"),
    ...sorted.filter(s => s.observations).map(s =>
      React.createElement(Text, { key: s.id, style: { fontSize: 9, marginBottom: 4 } },
        `· ${s.first_name} ${s.last_name}: ${s.observations}`)
    ),
    sorted.every(s => !s.observations)
      ? React.createElement(Text, { style: { fontSize: 9, color: "#64748b" } }, "Sin observaciones registradas.")
      : null,

    React.createElement(View, { style: pdfStyles.footer, fixed: true },
      React.createElement(Text, { style: pdfStyles.footerText }, "ClassMixer · Informe de tutoría — uso interno"),
      React.createElement(Text, { style: pdfStyles.footerText, render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `Pág. ${pageNumber} / ${totalPages}` }),
    )
  )
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params
  const supabase = createServiceClient()

  const { data: proposalRaw, error } = await (supabase as any)
    .from("proposals")
    .select("*, processes!inner(id, name, school_year, center_id), proposal_assignments(*, students(*))")
    .eq("id", id)
    .single()

  if (error || !proposalRaw) return NextResponse.json({ error: "No encontrada" }, { status: 404 })
  if (proposalRaw.processes?.center_id !== profile.center_id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const proposal = proposalRaw as any
  const process = proposal.processes

  let allowedClasses: string[] | null = null
  if (!hasFullAccess(profile.role)) {
    if (profile.role !== "tutor") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 })
    }
    const { data: tutorClasses } = await supabase
      .from("proposal_class_tutors")
      .select("target_class")
      .eq("proposal_id", id)
      .eq("user_id", profile.id)
    allowedClasses = (tutorClasses ?? []).map((t: any) => t.target_class)
    if (allowedClasses.length === 0) {
      return NextResponse.json({ error: "No tienes ninguna clase asignada en esta propuesta" }, { status: 403 })
    }
  }

  const { data: responses } = await supabase.from("responses").select("*").eq("process_id", process.id)
  const catalogIndex = await getQuestionCatalogIndex(profile.center_id)
  const friendshipLike = catalogIndex.scoringRoles.friendshipLike

  const classMap = new Map<string, any[]>()
  for (const a of (proposal.proposal_assignments ?? [])) {
    if (!classMap.has(a.target_class)) classMap.set(a.target_class, [])
    if (a.students) classMap.get(a.target_class)!.push(a.students)
  }

  let targetClasses = [...classMap.keys()].sort()
  if (allowedClasses) targetClasses = targetClasses.filter(c => allowedClasses!.includes(c))

  if (targetClasses.length === 0) {
    return NextResponse.json({ error: "No hay clases disponibles para generar el informe" }, { status: 404 })
  }

  const pages = targetClasses.map(cls => {
    const students = classMap.get(cls) ?? []
    const ids = new Set(students.map((s: any) => s.id))
    const clsResponses = (responses ?? []).filter((r: any) =>
      friendshipLike.includes(r.relation_type) && ids.has(r.respondent_student_id) && ids.has(r.target_student_id)
    )
    const soc = calculateSociogram(students as any, clsResponses as any, friendshipLike)
    const friendSummary = new Map<string, string>()
    for (const node of soc.nodes) {
      const parts: string[] = []
      if (node.reciprocal_count > 0) parts.push(`${node.reciprocal_count} recíproca(s)`)
      if (node.is_isolated) parts.push("Sin conexiones")
      if (node.is_vulnerable) parts.push("Vulnerable")
      if (node.is_leader) parts.push("Líder social")
      friendSummary.set(node.id, parts.length > 0 ? parts.join(", ") : `${node.given_count} elegido(s)`)
    }
    return React.createElement(ClassPage, { key: cls, process, cls, students, friendSummary })
  })

  const buffer = await renderToBuffer(React.createElement(Document, null, ...pages) as any)

  await logAudit(profile.id, profile.center_id, "export_informe_tutores", "proposal", {
    processId: process.id,
    entityId: id,
    metadata: { classes: targetClasses },
  })

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="informe-tutoria-${proposal.name.replace(/\s+/g, "-")}.pdf"`,
    },
  })
}
