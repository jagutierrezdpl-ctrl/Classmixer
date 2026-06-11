/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/auth"
import { NextResponse } from "next/server"
import React from "react"
import { Document, Page, Text, View, StyleSheet, renderToBuffer, Font } from "@react-pdf/renderer"

Font.register({
  family: "Helvetica",
  fonts: [],
})

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 10, color: "#1e293b" },
  header: { marginBottom: 24 },
  title: { fontSize: 20, fontWeight: "bold", color: "#1e40af", marginBottom: 4 },
  subtitle: { fontSize: 11, color: "#64748b" },
  metaRow: { flexDirection: "row", gap: 16, marginTop: 8 },
  metaBadge: { backgroundColor: "#eff6ff", padding: "4 8", borderRadius: 4, fontSize: 9, color: "#1e40af" },
  sectionTitle: { fontSize: 13, fontWeight: "bold", color: "#1e293b", marginBottom: 8, marginTop: 16, borderBottom: "1pt solid #e2e8f0", paddingBottom: 4 },
  classCard: { marginBottom: 16, border: "1pt solid #e2e8f0", borderRadius: 6, overflow: "hidden" },
  classHeader: { backgroundColor: "#1e40af", padding: "8 12", flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  classTitle: { fontSize: 12, fontWeight: "bold", color: "#ffffff" },
  classCount: { fontSize: 10, color: "#bfdbfe" },
  statsRow: { flexDirection: "row", backgroundColor: "#f8fafc", padding: "6 12", borderBottom: "1pt solid #e2e8f0", gap: 20 },
  statItem: { flex: 1 },
  statLabel: { fontSize: 8, color: "#64748b", marginBottom: 1 },
  statValue: { fontSize: 10, fontWeight: "bold", color: "#1e293b" },
  studentTable: { padding: "0 12 8 12" },
  tableHeader: { flexDirection: "row", borderBottom: "1pt solid #e2e8f0", paddingBottom: 4, marginBottom: 4, marginTop: 6 },
  thCell: { fontSize: 8, fontWeight: "bold", color: "#64748b", textTransform: "uppercase" },
  tableRow: { flexDirection: "row", paddingVertical: 3, borderBottom: "0.5pt solid #f1f5f9" },
  tdCell: { fontSize: 9, color: "#334155" },
  colName: { flex: 3 },
  colClass: { flex: 1.2 },
  colGender: { flex: 0.8 },
  colGrade: { flex: 0.8 },
  colLevel: { flex: 1.2 },
  colNeeds: { flex: 1 },
  footer: { position: "absolute", bottom: 30, left: 40, right: 40, flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 8, color: "#94a3b8" },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  summaryCard: { flex: 1, minWidth: "22%", backgroundColor: "#f8fafc", border: "1pt solid #e2e8f0", borderRadius: 6, padding: "8 10" },
  summaryValue: { fontSize: 18, fontWeight: "bold", color: "#1e40af" },
  summaryLabel: { fontSize: 8, color: "#64748b", marginTop: 2 },
})

const LEVEL_SHORT: Record<string, string> = {
  "Alto": "Alto",
  "Medio-alto": "M-A",
  "Medio": "Medio",
  "Medio-bajo": "M-B",
  "Bajo": "Bajo",
}

const GENDER_LABEL: Record<string, string> = { F: "F", M: "M", Otro: "O", "No especificado": "?" }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ProposalPDF({ proposal, classesList }: { proposal: any; classesList: Array<{ name: string; students: any[] }> }) {
  const totalStudents = classesList.reduce((s, c) => s + c.students.length, 0)
  const totalFemale = classesList.reduce((s, c) => s + c.students.filter((st: any) => st.gender === "F").length, 0)
  const totalMale = classesList.reduce((s, c) => s + c.students.filter((st: any) => st.gender === "M").length, 0)
  const avgGrade = (() => {
    const valid = classesList.flatMap(c => c.students).filter((st: any) => st.average_grade > 0)
    return valid.length > 0 ? (valid.reduce((s: number, st: any) => s + st.average_grade, 0) / valid.length).toFixed(2) : "—"
  })()
  const dateStr = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })

  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: "A4", style: styles.page },
      // Header
      React.createElement(View, { style: styles.header },
        React.createElement(Text, { style: styles.title }, proposal.name ?? "Propuesta de distribución"),
        React.createElement(Text, { style: styles.subtitle }, `Generado el ${dateStr} · ClassMixer`),
        React.createElement(View, { style: styles.metaRow },
          React.createElement(View, { style: styles.metaBadge },
            React.createElement(Text, null, `Puntuación: ${(proposal.score_total ?? 0).toFixed(1)}/100`)
          ),
          React.createElement(View, { style: styles.metaBadge },
            React.createElement(Text, null, `${totalStudents} alumnos`)
          ),
          React.createElement(View, { style: styles.metaBadge },
            React.createElement(Text, null, `${classesList.length} clases`)
          ),
        )
      ),
      // Summary
      React.createElement(Text, { style: styles.sectionTitle }, "Resumen global"),
      React.createElement(View, { style: styles.summaryGrid },
        React.createElement(View, { style: styles.summaryCard },
          React.createElement(Text, { style: styles.summaryValue }, String(totalStudents)),
          React.createElement(Text, { style: styles.summaryLabel }, "Alumnos totales")
        ),
        React.createElement(View, { style: styles.summaryCard },
          React.createElement(Text, { style: styles.summaryValue }, `${totalFemale}F/${totalMale}M`),
          React.createElement(Text, { style: styles.summaryLabel }, "Distribución género")
        ),
        React.createElement(View, { style: styles.summaryCard },
          React.createElement(Text, { style: styles.summaryValue }, avgGrade),
          React.createElement(Text, { style: styles.summaryLabel }, "Nota media global")
        ),
        React.createElement(View, { style: styles.summaryCard },
          React.createElement(Text, { style: styles.summaryValue }, String(classesList.length)),
          React.createElement(Text, { style: styles.summaryLabel }, "Clases destino")
        ),
      ),
      // Classes
      React.createElement(Text, { style: styles.sectionTitle }, "Distribución por clase"),
      ...classesList.map(cls =>
        React.createElement(View, { key: cls.name, style: styles.classCard, wrap: false },
          // Class header
          React.createElement(View, { style: styles.classHeader },
            React.createElement(Text, { style: styles.classTitle }, cls.name),
            React.createElement(Text, { style: styles.classCount }, `${cls.students.length} alumnos`)
          ),
          // Stats
          React.createElement(View, { style: styles.statsRow },
            React.createElement(View, { style: styles.statItem },
              React.createElement(Text, { style: styles.statLabel }, "Nota media"),
              React.createElement(Text, { style: styles.statValue }, (() => {
                const valid = cls.students.filter((st: any) => st.average_grade > 0)
                return valid.length > 0 ? (valid.reduce((s: number, st: any) => s + st.average_grade, 0) / valid.length).toFixed(2) : "—"
              })())
            ),
            React.createElement(View, { style: styles.statItem },
              React.createElement(Text, { style: styles.statLabel }, "Género"),
              React.createElement(Text, { style: styles.statValue },
                `${cls.students.filter((st: any) => st.gender === "F").length}F / ${cls.students.filter((st: any) => st.gender === "M").length}M`
              )
            ),
            React.createElement(View, { style: styles.statItem },
              React.createElement(Text, { style: styles.statLabel }, "Con NEE"),
              React.createElement(Text, { style: styles.statValue },
                String(cls.students.filter((st: any) => st.needs_type && st.needs_type !== "No").length)
              )
            ),
            React.createElement(View, { style: styles.statItem },
              React.createElement(Text, { style: styles.statLabel }, "Seguimiento"),
              React.createElement(Text, { style: styles.statValue },
                String(cls.students.filter((st: any) => ["Seguimiento", "Conflictiva"].includes(st.behavior_level ?? "")).length)
              )
            ),
          ),
          // Students table
          React.createElement(View, { style: styles.studentTable },
            React.createElement(View, { style: styles.tableHeader },
              React.createElement(Text, { style: [styles.thCell, styles.colName] }, "Alumno"),
              React.createElement(Text, { style: [styles.thCell, styles.colClass] }, "Clase origen"),
              React.createElement(Text, { style: [styles.thCell, styles.colGender] }, "Género"),
              React.createElement(Text, { style: [styles.thCell, styles.colGrade] }, "Nota"),
              React.createElement(Text, { style: [styles.thCell, styles.colLevel] }, "Nivel"),
              React.createElement(Text, { style: [styles.thCell, styles.colNeeds] }, "NEE"),
            ),
            ...[...cls.students]
              .sort((a: any, b: any) => a.last_name?.localeCompare(b.last_name ?? "") ?? 0)
              .map((st: any) =>
                React.createElement(View, { key: st.id, style: styles.tableRow },
                  React.createElement(Text, { style: [styles.tdCell, styles.colName] }, `${st.last_name ?? ""}, ${st.first_name ?? ""}`),
                  React.createElement(Text, { style: [styles.tdCell, styles.colClass] }, st.current_class ?? ""),
                  React.createElement(Text, { style: [styles.tdCell, styles.colGender] }, GENDER_LABEL[st.gender ?? ""] ?? st.gender ?? ""),
                  React.createElement(Text, { style: [styles.tdCell, styles.colGrade] }, st.average_grade > 0 ? String(st.average_grade) : "—"),
                  React.createElement(Text, { style: [styles.tdCell, styles.colLevel] }, LEVEL_SHORT[st.academic_level ?? ""] ?? st.academic_level ?? "—"),
                  React.createElement(Text, { style: [styles.tdCell, styles.colNeeds] }, st.needs_type && st.needs_type !== "No" ? "Sí" : "No"),
                )
              )
          )
        )
      ),
      // Footer
      React.createElement(View, { style: styles.footer, fixed: true },
        React.createElement(Text, { style: styles.footerText }, "ClassMixer · Documento confidencial — solo para uso interno"),
        React.createElement(Text, { style: styles.footerText, render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `Pág. ${pageNumber} / ${totalPages}` }),
      )
    )
  )
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const supabase = createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: proposalRaw, error } = await (supabase as any)
    .from("proposals")
    .select("*, processes!inner(center_id), proposal_assignments(*, students(*))")
    .eq("id", id)
    .single()

  if (error || !proposalRaw) return NextResponse.json({ error: "No encontrada" }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((proposalRaw as any).processes?.center_id !== profile.center_id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proposal = proposalRaw as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const assignments: any[] = proposal.proposal_assignments ?? []

  // Group by class
  const classMap = new Map<string, any[]>()
  for (const a of assignments) {
    if (!classMap.has(a.target_class)) classMap.set(a.target_class, [])
    if (a.students) classMap.get(a.target_class)!.push(a.students)
  }

  const classesList = [...classMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, students]) => ({ name, students }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(React.createElement(ProposalPDF, { proposal, classesList }) as any)

  const safeName = (proposal.name ?? "propuesta").replace(/[^a-z0-9]/gi, "-").toLowerCase()

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeName}.pdf"`,
    },
  })
}
