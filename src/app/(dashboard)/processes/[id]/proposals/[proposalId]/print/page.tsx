import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/auth"
import { notFound } from "next/navigation"
import PrintButton from "../report/PrintButton"

const LEVEL_ABBR: Record<string, string> = {
  Alto: "A", "Medio-alto": "MA", Medio: "M", "Medio-bajo": "MB", Bajo: "B",
}
const BEHAVIOR_COLOR: Record<string, string> = {
  Positiva: "text-green-700",
  Normal: "text-foreground",
  Seguimiento: "text-amber-700 font-semibold",
  Conflictiva: "text-red-700 font-semibold",
}
const NEEDS_ABBR: Record<string, string> = {
  No: "", Sí: "NEE", ACNEAE: "ACNEAE", NEE: "NEE", Refuerzo: "REF",
  "Altas capacidades": "AC", "Observación interna": "OBS",
}

export default async function PrintPage({
  params,
}: {
  params: Promise<{ id: string; proposalId: string }>
}) {
  const { id: processId, proposalId } = await params
  const profile = await getUserProfile()
  if (!profile) notFound()

  const supabase = createServiceClient()

  const [{ data: processRaw }, { data: proposalRaw }] = await Promise.all([
    supabase.from("processes").select("*").eq("id", processId).single(),
    supabase
      .from("proposals")
      .select("*, proposal_assignments(*, students(*))")
      .eq("id", proposalId)
      .single(),
  ])

  if (!processRaw || !proposalRaw) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const process = processRaw as any
  if (process.center_id !== profile.center_id) notFound()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proposal = proposalRaw as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const assignments: any[] = proposal.proposal_assignments ?? []

  const targetClasses: string[] = (process.target_groups as string[]) ?? []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const classOrder = targetClasses.length > 0 ? targetClasses : [...new Set(assignments.map((a: any) => a.target_class as string))].sort()

  // Group by target class
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byClass: Record<string, any[]> = {}
  for (const cls of classOrder) byClass[cls] = []
  for (const a of assignments) {
    const cls = a.target_class as string
    if (!byClass[cls]) byClass[cls] = []
    byClass[cls].push(a.students)
  }
  // Sort each class alphabetically
  for (const cls of Object.keys(byClass)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    byClass[cls].sort((a: any, b: any) => {
      const la = `${a.last_name ?? ""} ${a.first_name ?? ""}`.toLowerCase()
      const lb = `${b.last_name ?? ""} ${b.first_name ?? ""}`.toLowerCase()
      return la.localeCompare(lb)
    })
  }

  const today = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })

  // Summary stats per class
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function classStats(students: any[]) {
    const total = students.length
    const girls = students.filter(s => s.gender === "F").length
    const boys = students.filter(s => s.gender === "M").length
    const avg = total > 0 ? (students.reduce((acc, s) => acc + (s.average_grade ?? 0), 0) / total).toFixed(1) : "—"
    const withNeeds = students.filter(s => s.needs_type && s.needs_type !== "No").length
    const withBehavior = students.filter(s => s.behavior_level && !["Positiva", "Normal"].includes(s.behavior_level)).length
    return { total, girls, boys, avg, withNeeds, withBehavior }
  }

  return (
    <div className="bg-white min-h-screen">
      {/* Toolbar — hidden when printing */}
      <div className="print:hidden sticky top-0 z-10 flex items-center justify-between px-8 py-3 bg-card border-b">
        <div>
          <h1 className="font-bold">{proposal.name} — Listados de clase</h1>
          <p className="text-sm text-muted-foreground">{process.name} · {process.school_year}</p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={`/processes/${processId}/proposals`}
            className="text-sm text-muted-foreground hover:text-foreground underline"
          >
            ← Volver
          </a>
          <PrintButton />
        </div>
      </div>

      {/* Global header — visible on every print page via CSS */}
      <div className="hidden print:block text-xs text-gray-400 px-8 pt-4 pb-0">
        {process.name} · {proposal.name} · {today}
      </div>

      <div className="px-8 pb-12 space-y-0">
        {classOrder.map((cls, idx) => {
          const students = byClass[cls] ?? []
          const stats = classStats(students)
          return (
            <div
              key={cls}
              className={`${idx > 0 ? "break-before-page" : ""} pt-8`}
            >
              {/* Class header */}
              <div className="flex items-end justify-between mb-3 border-b-2 border-gray-800 pb-2">
                <div>
                  <h2 className="text-xl font-bold">{cls}</h2>
                  <p className="text-sm text-gray-500">{process.target_level} · Curso {process.school_year}</p>
                </div>
                <div className="flex gap-6 text-right text-xs text-gray-500">
                  <div><span className="font-semibold text-gray-800 text-sm">{stats.total}</span><br />alumnos</div>
                  <div><span className="font-semibold text-gray-800 text-sm">{stats.girls}F / {stats.boys}M</span><br />género</div>
                  <div><span className="font-semibold text-gray-800 text-sm">{stats.avg}</span><br />nota media</div>
                  {stats.withNeeds > 0 && <div><span className="font-semibold text-amber-700 text-sm">{stats.withNeeds}</span><br />con NEE/apoyo</div>}
                  {stats.withBehavior > 0 && <div><span className="font-semibold text-red-700 text-sm">{stats.withBehavior}</span><br />seguimiento</div>}
                </div>
              </div>

              {/* Student table */}
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-gray-400 font-medium">
                    <th className="text-left py-1.5 pr-4 w-6">#</th>
                    <th className="text-left py-1.5 pr-4">Apellidos, Nombre</th>
                    <th className="text-center py-1.5 pr-4 w-8">G</th>
                    <th className="text-center py-1.5 pr-4 w-10">Nota</th>
                    <th className="text-center py-1.5 pr-4 w-8">Niv</th>
                    <th className="text-left py-1.5 pr-4 w-16">Origen</th>
                    <th className="text-left py-1.5 pr-4 w-20">Apoyo</th>
                    <th className="text-left py-1.5">Conducta</th>
                  </tr>
                </thead>
                <tbody>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {students.map((s: any, i: number) => {
                    const needsLabel = s.needs_type ? (NEEDS_ABBR[s.needs_type] ?? s.needs_type) : ""
                    const behaviorColor = BEHAVIOR_COLOR[s.behavior_level ?? ""] ?? ""
                    return (
                      <tr key={s.id} className={`border-b border-gray-100 ${i % 2 === 1 ? "bg-gray-50" : ""}`}>
                        <td className="py-2 pr-4 text-gray-400 text-xs">{i + 1}</td>
                        <td className="py-2 pr-4 font-medium">
                          {s.last_name ?? ""}{s.last_name && s.first_name ? ", " : ""}{s.first_name ?? ""}
                        </td>
                        <td className="py-2 pr-4 text-center text-gray-500 text-xs">{s.gender ?? "—"}</td>
                        <td className="py-2 pr-4 text-center tabular-nums">
                          {s.average_grade != null ? Number(s.average_grade).toFixed(1) : "—"}
                        </td>
                        <td className="py-2 pr-4 text-center text-xs text-gray-500">
                          {s.academic_level ? (LEVEL_ABBR[s.academic_level] ?? s.academic_level) : "—"}
                        </td>
                        <td className="py-2 pr-4 text-xs text-gray-600">{s.current_class ?? "—"}</td>
                        <td className="py-2 pr-4 text-xs text-amber-700 font-medium">{needsLabel}</td>
                        <td className={`py-2 text-xs ${behaviorColor}`}>
                          {s.behavior_level && s.behavior_level !== "Normal" ? s.behavior_level : ""}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {/* Observations block */}
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {students.some((s: any) => s.observations) && (
                <div className="mt-4 space-y-1">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Observaciones</p>
                  {students
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    .filter((s: any) => s.observations)
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    .map((s: any, i: number) => (
                      <p key={i} className="text-xs text-gray-600">
                        <span className="font-medium">{s.last_name}, {s.first_name}:</span> {s.observations}
                      </p>
                    ))}
                </div>
              )}

              {/* Blank signature lines for tutors */}
              <div className="mt-8 grid grid-cols-2 gap-8 print:mt-12">
                <div>
                  <div className="border-t border-gray-400 pt-1 mt-6">
                    <p className="text-xs text-gray-400">Tutor/a</p>
                  </div>
                </div>
                <div>
                  <div className="border-t border-gray-400 pt-1 mt-6">
                    <p className="text-xs text-gray-400">Jefe/a de estudios · {today}</p>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
