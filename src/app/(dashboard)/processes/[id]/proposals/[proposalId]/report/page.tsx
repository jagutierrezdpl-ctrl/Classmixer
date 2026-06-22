import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/auth"
import { notFound } from "next/navigation"
import PrintButton from "./PrintButton"

export default async function ReportPage({
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
      .select("*, proposal_assignments(*, students(*)), proposal_metrics(*)")
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

  // Build metrics map
  const metricsMap: Record<string, Record<string, number>> = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(proposal.proposal_metrics ?? []).forEach((m: any) => {
    if (m.target_class) {
      if (!metricsMap[m.target_class]) metricsMap[m.target_class] = {}
      metricsMap[m.target_class][m.metric_key] = m.metric_value
    }
  })

  const today = new Date().toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })

  return (
    <div className="bg-background">
      {/* Print toolbar — hidden when printing */}
      <div className="print:hidden sticky top-0 z-10 flex items-center justify-between px-8 py-3 bg-card border-b">
        <div>
          <h1 className="font-bold">{proposal.name} — Informe</h1>
          <p className="text-sm text-muted-foreground">{process.name} · {process.school_year}</p>
        </div>
        <div className="flex gap-2">
          <a
            href={`/processes/${processId}/proposals`}
            className="text-sm text-muted-foreground hover:text-foreground underline"
          >
            ← Volver a propuestas
          </a>
          <PrintButton />
        </div>
      </div>

      <div className="px-10 py-8 max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-1">{process.name}</h2>
          <p className="text-muted-foreground">
            {process.source_level} → {process.target_level} · Curso {process.school_year}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {proposal.name} · Generado el {today}
          </p>
          {proposal.status === "aprobada" && (
            <span className="inline-block mt-2 px-3 py-1 rounded-full bg-green-100 text-green-800 text-sm font-semibold">
              ✓ Propuesta aprobada
            </span>
          )}
        </div>

        {/* Resumen ejecutivo */}
        <section className="mb-10">
          <h3 className="text-lg font-bold mb-4 pb-2 border-b">Resumen ejecutivo</h3>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-3 py-2 border">Clase</th>
                <th className="text-center px-3 py-2 border">Alumnos</th>
                <th className="text-center px-3 py-2 border">Chicas</th>
                <th className="text-center px-3 py-2 border">Chicos</th>
                <th className="text-center px-3 py-2 border">Nota media</th>
                <th className="text-center px-3 py-2 border">Con amigo</th>
                <th className="text-center px-3 py-2 border">Nec. Educ.</th>
                <th className="text-center px-3 py-2 border">Seguimiento</th>
              </tr>
            </thead>
            <tbody>
              {targetClasses.map(cls => {
                const m = metricsMap[cls] ?? {}
                return (
                  <tr key={cls} className="hover:bg-muted/20">
                    <td className="px-3 py-2 border font-semibold">{cls}</td>
                    <td className="px-3 py-2 border text-center">{m.count ?? 0}</td>
                    <td className="px-3 py-2 border text-center">{m.female ?? 0}</td>
                    <td className="px-3 py-2 border text-center">{m.male ?? 0}</td>
                    <td className="px-3 py-2 border text-center">
                      {m.average_grade ? m.average_grade.toFixed(2) : "—"}
                    </td>
                    <td className="px-3 py-2 border text-center">
                      {m.students_with_friend !== undefined && m.count
                        ? `${m.students_with_friend}/${m.count} (${Math.round((m.students_with_friend / m.count) * 100)}%)`
                        : "—"}
                    </td>
                    <td className="px-3 py-2 border text-center">{m.with_needs ?? 0}</td>
                    <td className="px-3 py-2 border text-center">{m.with_behavior_issues ?? 0}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Puntuaciones */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            {[
              { label: "Puntuación total", value: proposal.score_total },
              { label: "Social", value: proposal.score_social },
              { label: "Académico", value: proposal.score_academic },
              { label: "Género", value: proposal.score_gender },
            ].map(({ label, value }) => (
              <div key={label} className="border rounded-lg px-3 py-2 text-center">
                <p className="text-muted-foreground text-xs">{label}</p>
                <p className="text-xl font-bold">{(value ?? 0).toFixed(1)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Distribución por clase */}
        {targetClasses.map(cls => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const classStudents: any[] = (assignments
            .filter((a: { target_class: string }) => a.target_class === cls)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((a: any) => a.students)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .filter(Boolean) as any[])
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .sort((a: any, b: any) => (a.last_name ?? "").localeCompare(b.last_name ?? ""))

          const m = metricsMap[cls] ?? {}

          return (
            <section key={cls} className="mb-10 break-inside-avoid">
              <h3 className="text-lg font-bold mb-2 pb-2 border-b">
                Clase {cls}
                <span className="font-normal text-muted-foreground text-sm ml-3">
                  {classStudents.length} alumnos ·
                  Nota media: {m.average_grade?.toFixed(2) ?? "—"} ·
                  {m.female ?? 0} chicas / {m.male ?? 0} chicos
                </span>
              </h3>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left px-3 py-2 border">#</th>
                    <th className="text-left px-3 py-2 border">Apellidos, Nombre</th>
                    <th className="text-center px-3 py-2 border">Clase origen</th>
                    <th className="text-center px-3 py-2 border">Género</th>
                    <th className="text-center px-3 py-2 border">Nota</th>
                    <th className="text-center px-3 py-2 border">Nivel</th>
                    <th className="text-center px-3 py-2 border">Nec. educ.</th>
                    <th className="text-left px-3 py-2 border">Observaciones</th>
                  </tr>
                </thead>
                <tbody>
                  {classStudents.map((s: {
                    id: string; last_name?: string; first_name?: string; current_class?: string;
                    gender?: string; average_grade?: number; academic_level?: string;
                    needs_type?: string; observations?: string; behavior_level?: string
                  }, i: number) => (
                    <tr
                      key={s.id}
                      className={`${
                        s.behavior_level === "Seguimiento" || s.behavior_level === "Conflictiva"
                          ? "bg-orange-50"
                          : i % 2 === 0
                          ? ""
                          : "bg-muted/20"
                      }`}
                    >
                      <td className="px-3 py-1.5 border text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-1.5 border font-medium">
                        {s.last_name}, {s.first_name}
                      </td>
                      <td className="px-3 py-1.5 border text-center">{s.current_class ?? "—"}</td>
                      <td className="px-3 py-1.5 border text-center">{s.gender ?? "—"}</td>
                      <td className="px-3 py-1.5 border text-center">
                        {s.average_grade ? s.average_grade.toFixed(1) : "—"}
                      </td>
                      <td className="px-3 py-1.5 border text-center">{s.academic_level ?? "—"}</td>
                      <td className="px-3 py-1.5 border text-center">
                        {s.needs_type && s.needs_type !== "No" ? s.needs_type : ""}
                      </td>
                      <td className="px-3 py-1.5 border text-xs text-muted-foreground">
                        {s.observations ?? ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )
        })}

        {/* Footer */}
        <div className="mt-8 pt-4 border-t text-xs text-muted-foreground">
          <p>Informe generado por ClassMixer · {today} · Solo para uso interno del centro educativo.</p>
          <p className="mt-1">
            Este documento contiene datos personales de menores. Trátalo con confidencialidad conforme al RGPD.
          </p>
        </div>
      </div>
    </div>
  )
}
