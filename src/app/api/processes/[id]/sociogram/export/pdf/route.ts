/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, hasFullAccess, tutorCanAccessProcess, logAudit } from "@/lib/auth"
import { NextResponse } from "next/server"
import React from "react"
import { Document, Page, Text, View, Svg, Circle, Line, renderToBuffer } from "@react-pdf/renderer"
import { calculateSociogram } from "@/lib/sociogram/calculate"
import { pdfStyles, formatDate, ALERT_STYLE_BY_SEVERITY } from "@/lib/pdf/shared"
import { getQuestionCatalogIndex } from "@/lib/questionnaire/catalog"
import { filterVisibleResponses } from "@/lib/questionnaire/visibility"
import type { UserRole } from "@/types"

const COMMUNITY_COLORS = ["#2563eb", "#16a34a", "#d97706", "#dc2626", "#7c3aed", "#0891b2", "#db2777", "#65a30d", "#ea580c", "#4338ca"]

const CX = 260
const CY = 200
const RADIUS = 165

function layout(nodes: ReturnType<typeof calculateSociogram>["nodes"]) {
  const n = nodes.length
  return nodes.map((node, i) => {
    const angle = (2 * Math.PI * i) / Math.max(n, 1) - Math.PI / 2
    return {
      node,
      x: CX + RADIUS * Math.cos(angle),
      y: CY + RADIUS * Math.sin(angle),
      index: i + 1,
    }
  })
}

function SociogramGraph({ soc }: { soc: ReturnType<typeof calculateSociogram> }) {
  const positions = layout(soc.nodes)
  const posById = new Map(positions.map(p => [p.node.id, p]))
  const friendshipEdges = soc.edges.filter(e => e.relation_type === "friendship")

  return React.createElement(Svg, { width: "100%", height: 400, viewBox: "0 0 520 400" } as any,
    ...friendshipEdges.map(e => {
      const a = posById.get(e.source)
      const b = posById.get(e.target)
      if (!a || !b) return null
      return React.createElement(Line, {
        key: e.id,
        x1: a.x, y1: a.y, x2: b.x, y2: b.y,
        stroke: e.is_reciprocal ? "#1e40af" : "#cbd5e1",
        strokeWidth: e.is_reciprocal ? 1.6 : 0.6,
      } as any)
    }),
    ...positions.map(p => {
      const r = 7 + Math.min(p.node.received_count, 10) * 1.1
      const color = COMMUNITY_COLORS[(p.node.community_id ?? 0) % COMMUNITY_COLORS.length]
      return React.createElement(React.Fragment, { key: p.node.id },
        React.createElement(Circle, {
          cx: p.x, cy: p.y, r,
          fill: p.node.is_isolated ? "#f87171" : color,
          stroke: p.node.is_vulnerable ? "#f59e0b" : "#ffffff",
          strokeWidth: p.node.is_vulnerable ? 2 : 1,
        } as any),
        React.createElement(Text, {
          x: p.x, y: p.y + 3,
          style: { fontSize: 7, fill: "#ffffff", textAnchor: "middle" } as any,
        } as any, String(p.index)),
      )
    }),
  )
}

function nameOf(s: any): string {
  return s ? `${s.first_name} ${s.last_name}` : "Alumno desconocido"
}

function SociogramaPDF({ process, soc, positions, studentMap }: {
  process: any
  soc: ReturnType<typeof calculateSociogram>
  positions: ReturnType<typeof layout>
  studentMap: Map<string, any>
}) {
  const mostChosen = [...soc.nodes].sort((a, b) => b.received_count - a.received_count).slice(0, 8)
  const leastChosen = [...soc.nodes].sort((a, b) => a.received_count - b.received_count).slice(0, 8)
  const reciprocalPairs = soc.edges.filter(e => e.relation_type === "friendship" && e.is_reciprocal)

  return React.createElement(Document, null,
    React.createElement(Page, { size: "A4", style: pdfStyles.page },
      React.createElement(View, { style: pdfStyles.header },
        React.createElement(Text, { style: pdfStyles.title }, "Informe de sociograma"),
        React.createElement(Text, { style: pdfStyles.subtitle }, `${process.name} · ${process.school_year} · ${formatDate()}`),
      ),

      React.createElement(Text, { style: pdfStyles.sectionTitle }, "Métricas sociales"),
      React.createElement(View, { style: pdfStyles.summaryGrid },
        React.createElement(View, { style: pdfStyles.summaryCard },
          React.createElement(Text, { style: pdfStyles.summaryValue }, String(soc.metrics.total_students)),
          React.createElement(Text, { style: pdfStyles.summaryLabel }, "Alumnos")),
        React.createElement(View, { style: pdfStyles.summaryCard },
          React.createElement(Text, { style: pdfStyles.summaryValue }, String(soc.metrics.isolated_count)),
          React.createElement(Text, { style: pdfStyles.summaryLabel }, "Aislados")),
        React.createElement(View, { style: pdfStyles.summaryCard },
          React.createElement(Text, { style: pdfStyles.summaryValue }, String(soc.metrics.reciprocal_pairs)),
          React.createElement(Text, { style: pdfStyles.summaryLabel }, "Parejas recíprocas")),
        React.createElement(View, { style: pdfStyles.summaryCard },
          React.createElement(Text, { style: pdfStyles.summaryValue }, String(soc.metrics.communities_count)),
          React.createElement(Text, { style: pdfStyles.summaryLabel }, "Subgrupos")),
        React.createElement(View, { style: pdfStyles.summaryCard },
          React.createElement(Text, { style: pdfStyles.summaryValue }, soc.metrics.density.toFixed(2)),
          React.createElement(Text, { style: pdfStyles.summaryLabel }, "Densidad de red")),
        React.createElement(View, { style: pdfStyles.summaryCard },
          React.createElement(Text, { style: pdfStyles.summaryValue }, (soc.metrics.group_cohesion * 100).toFixed(1) + "%"),
          React.createElement(Text, { style: pdfStyles.summaryLabel }, "Cohesión grupal (IAg)")),
      ),

      React.createElement(Text, { style: pdfStyles.sectionTitle }, "Grafo de relaciones de amistad"),
      React.createElement(SociogramGraph, { soc }),
      React.createElement(Text, { style: { fontSize: 8, color: "#64748b", marginTop: 4 } },
        "Línea azul = relación recíproca · Línea gris = elección unilateral · Borde naranja = alumno vulnerable · Nodo rojo = alumno aislado"),

      React.createElement(View, { style: pdfStyles.footer, fixed: true },
        React.createElement(Text, { style: pdfStyles.footerText }, "ClassMixer · Informe de sociograma — uso interno"),
        React.createElement(Text, { style: pdfStyles.footerText, render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `Pág. ${pageNumber} / ${totalPages}` }),
      )
    ),

    React.createElement(Page, { size: "A4", style: pdfStyles.page },
      React.createElement(Text, { style: pdfStyles.sectionTitle }, "Leyenda del grafo"),
      React.createElement(View, { style: pdfStyles.tableHeader },
        React.createElement(Text, { style: [pdfStyles.thCell, { flex: 0.5 }] }, "Nº"),
        React.createElement(Text, { style: [pdfStyles.thCell, { flex: 2.5 }] }, "Alumno"),
        React.createElement(Text, { style: [pdfStyles.thCell, { flex: 1 }] }, "Clase"),
        React.createElement(Text, { style: [pdfStyles.thCell, { flex: 1 }] }, "Recibidas"),
      ),
      ...positions.map(p =>
        React.createElement(View, { key: p.node.id, style: pdfStyles.tableRow },
          React.createElement(Text, { style: [pdfStyles.tdCell, { flex: 0.5 }] }, String(p.index)),
          React.createElement(Text, { style: [pdfStyles.tdCell, { flex: 2.5 }] }, p.node.label),
          React.createElement(Text, { style: [pdfStyles.tdCell, { flex: 1 }] }, p.node.current_class ?? "—"),
          React.createElement(Text, { style: [pdfStyles.tdCell, { flex: 1 }] }, String(p.node.received_count)),
        )
      ),

      React.createElement(Text, { style: pdfStyles.sectionTitle }, "Alumnos más elegidos"),
      ...mostChosen.map(n =>
        React.createElement(Text, { key: n.id, style: { fontSize: 9, marginBottom: 3 } }, `· ${n.label} — ${n.received_count} elección(es) recibida(s)`)
      ),

      React.createElement(Text, { style: pdfStyles.sectionTitle }, "Alumnos con menos elecciones"),
      ...leastChosen.map(n =>
        React.createElement(Text, { key: n.id, style: { fontSize: 9, marginBottom: 3 } }, `· ${n.label} — ${n.received_count} elección(es) recibida(s)`)
      ),

      React.createElement(Text, { style: pdfStyles.sectionTitle }, "Relaciones recíprocas"),
      reciprocalPairs.length > 0
        ? React.createElement(View, null, ...reciprocalPairs.map(e =>
            React.createElement(Text, { key: e.id, style: { fontSize: 9, marginBottom: 3 } },
              `· ${nameOf(studentMap.get(e.source))} ↔ ${nameOf(studentMap.get(e.target))}`)
          ))
        : React.createElement(Text, { style: { fontSize: 9, color: "#64748b" } }, "No se han detectado relaciones recíprocas."),

      React.createElement(Text, { style: pdfStyles.sectionTitle }, "Subgrupos detectados"),
      soc.communities.filter(c => c.size >= 2).length > 0
        ? React.createElement(View, null, ...soc.communities.filter(c => c.size >= 2).map(c =>
            React.createElement(Text, { key: c.id, style: { fontSize: 9, marginBottom: 3 } },
              `· ${c.is_closed ? "Subgrupo cerrado" : "Subgrupo"} de ${c.size}: ${c.members.map(id => nameOf(studentMap.get(id))).join(", ")}`)
          ))
        : React.createElement(Text, { style: { fontSize: 9, color: "#64748b" } }, "No se han detectado subgrupos."),

      React.createElement(Text, { style: pdfStyles.sectionTitle }, "Alertas"),
      soc.alerts.length > 0
        ? React.createElement(View, null, ...soc.alerts.map((a, i) =>
            React.createElement(View, { key: i, style: (ALERT_STYLE_BY_SEVERITY[a.severity] ?? ALERT_STYLE_BY_SEVERITY.low) },
              React.createElement(Text, { style: pdfStyles.alertText }, a.message))
          ))
        : React.createElement(Text, { style: { fontSize: 9, color: "#64748b" } }, "No hay alertas activas."),

      React.createElement(View, { style: pdfStyles.footer, fixed: true },
        React.createElement(Text, { style: pdfStyles.footerText }, "ClassMixer · Informe de sociograma — uso interno"),
        React.createElement(Text, { style: pdfStyles.footerText, render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `Pág. ${pageNumber} / ${totalPages}` }),
      )
    )
  )
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params
  const supabase = createServiceClient()

  const { data: process } = await supabase
    .from("processes")
    .select("*")
    .eq("id", id)
    .eq("center_id", profile.center_id)
    .single()

  if (!process) return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  if (!hasFullAccess(profile.role) && !(await tutorCanAccessProcess(profile.center_id, profile.id, id))) {
    return NextResponse.json({ error: "Sin acceso a este proceso" }, { status: 403 })
  }

  const [{ data: allStudents }, { data: allResponses }] = await Promise.all([
    supabase.from("students").select("*").eq("process_id", id).eq("active", true),
    supabase.from("responses").select("*").eq("process_id", id),
  ])

  if (!allStudents) return NextResponse.json({ error: "Error al cargar alumnos" }, { status: 500 })

  const students = (allStudents as any[]).filter(s => !s.excluded_from_mix)
  const excludedIds = new Set((allStudents as any[]).filter(s => s.excluded_from_mix).map(s => s.id))

  const catalogIndex = await getQuestionCatalogIndex(profile.center_id)
  const responses = (filterVisibleResponses(allResponses ?? [], profile.role as UserRole, catalogIndex.sensitivity) as any[])
    .filter(r => !excludedIds.has(r.respondent_student_id) && !excludedIds.has(r.target_student_id))

  const studentMap = new Map(students.map((s: any) => [s.id, s]))
  const soc = calculateSociogram(students as any, responses as any, catalogIndex.scoringRoles.friendshipLike, catalogIndex.excludedFromGraph)
  const positions = layout(soc.nodes)

  const buffer = await renderToBuffer(React.createElement(SociogramaPDF, { process, soc, positions, studentMap }) as any)

  await logAudit(profile.id, profile.center_id, "export_informe_sociograma", "process", {
    processId: id,
    metadata: { students: students.length },
  })

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=informe-sociograma.pdf",
    },
  })
}
