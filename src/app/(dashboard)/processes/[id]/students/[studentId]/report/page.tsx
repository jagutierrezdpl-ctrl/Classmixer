import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/auth"
import { notFound } from "next/navigation"
import Link from "next/link"
import PrintButton from "./PrintButton"

const RELATION_LABELS: Record<string, string> = {
  friendship: "Amistad",
  work: "Trabajo en clase",
  emotional: "Apoyo emocional",
  negative: "Conflicto",
}

export default async function StudentReportPage({
  params,
}: {
  params: Promise<{ id: string; studentId: string }>
}) {
  const { id: processId, studentId } = await params
  const profile = await getUserProfile()
  if (!profile) notFound()

  const canSeeSensitive = ["admin", "superadmin", "orientador"].includes(profile.role)
  const supabase = createServiceClient()

  const [
    { data: process },
    { data: student },
    { data: allStudents },
    { data: givenResponses },
    { data: receivedResponses },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { data: metricsRaw },
    { data: proposals },
  ] = await Promise.all([
    supabase.from("processes").select("name, school_year, source_level, target_level").eq("id", processId).single(),
    supabase.from("students").select("*").eq("id", studentId).eq("process_id", processId).single(),
    supabase.from("students").select("id, first_name, last_name, current_class").eq("process_id", processId).eq("active", true),
    supabase.from("responses").select("target_student_id, relation_type").eq("process_id", processId).eq("respondent_student_id", studentId),
    supabase.from("responses").select("respondent_student_id, relation_type").eq("process_id", processId).eq("target_student_id", studentId),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from("sociogram_metrics").select("*").eq("process_id", processId).eq("student_id", studentId).maybeSingle(),
    supabase.from("proposals")
      .select("id, name, status, proposal_assignments!inner(target_class)")
      .eq("process_id", processId)
      .eq("proposal_assignments.student_id", studentId),
  ])

  if (!student || !process) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const metrics = metricsRaw as any
  const studentMap = new Map((allStudents ?? []).map(s => [s.id, s]))

  const visibleGiven = (givenResponses ?? []).filter(r =>
    canSeeSensitive ? true : r.relation_type !== "emotional" && r.relation_type !== "negative"
  )
  const visibleReceived = (receivedResponses ?? []).filter(r =>
    canSeeSensitive ? true : r.relation_type !== "emotional" && r.relation_type !== "negative"
  )

  const givenTargets = new Set(visibleGiven.map(r => r.target_student_id))
  const receivedFrom = new Set(visibleReceived.map(r => r.respondent_student_id))
  const reciprocalIds = [...givenTargets].filter(id => receivedFrom.has(id))

  // Group given by target
  const givenByTarget = new Map<string, string[]>()
  for (const r of visibleGiven) {
    if (!givenByTarget.has(r.target_student_id)) givenByTarget.set(r.target_student_id, [])
    givenByTarget.get(r.target_student_id)!.push(r.relation_type)
  }

  // Group received by respondent
  const receivedByRespondent = new Map<string, string[]>()
  for (const r of visibleReceived) {
    if (!receivedByRespondent.has(r.respondent_student_id)) receivedByRespondent.set(r.respondent_student_id, [])
    receivedByRespondent.get(r.respondent_student_id)!.push(r.relation_type)
  }

  const isIsolated = visibleReceived.length === 0 && reciprocalIds.length === 0
  const isVulnerable = !isIsolated && reciprocalIds.length === 1

  const today = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })

  return (
    <div className="bg-background">
      {/* Toolbar — print:hidden */}
      <div className="print:hidden sticky top-0 z-10 flex items-center justify-between px-8 py-3 bg-card border-b">
        <div>
          <h1 className="font-bold text-sm">
            Informe individual — {student.first_name} {student.last_name}
          </h1>
          <p className="text-xs text-muted-foreground">{process.name} · {process.school_year}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/processes/${processId}/students/${studentId}`}
            className="text-sm text-muted-foreground hover:text-foreground underline"
          >
            ← Volver al alumno
          </Link>
          <PrintButton />
        </div>
      </div>

      <div className="px-10 py-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold mb-1">
              {student.first_name} {student.last_name}
            </h2>
            <p className="text-muted-foreground text-sm">
              {student.current_class} · {student.external_id ?? "Sin ID"}
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {process.name} · Curso {process.school_year}
            </p>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <p>Informe generado: {today}</p>
            <p className="text-xs mt-1">Solo para uso interno del centro</p>
          </div>
        </div>

        {/* Alertas */}
        {(isIsolated || isVulnerable) && (
          <div className={`mb-6 p-3 rounded-lg border text-sm font-medium ${
            isIsolated
              ? "bg-red-50 border-red-200 text-red-800"
              : "bg-amber-50 border-amber-200 text-amber-800"
          }`}>
            {isIsolated
              ? "⚠ ALUMNO AISLADO: No ha recibido ninguna elección de sus compañeros."
              : "⚠ ALUMNO VULNERABLE: Solo tiene una relación recíproca. Dependencia social alta."}
          </div>
        )}

        {/* Datos académicos */}
        <section className="mb-8">
          <h3 className="text-base font-bold mb-3 pb-1 border-b">Datos académicos</h3>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-4 text-sm">
            {[
              { label: "Género", value: student.gender ?? "—" },
              { label: "Nota media", value: student.average_grade ? String(student.average_grade) : "—" },
              { label: "Nivel", value: student.academic_level ?? "—" },
              { label: "Conducta", value: student.behavior_level ?? "—" },
              { label: "Nec. educ.", value: student.needs_type ?? "—" },
            ].map(({ label, value }) => (
              <div key={label} className="border rounded-lg px-3 py-2 text-center">
                <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                <p className="font-semibold">{value}</p>
              </div>
            ))}
          </div>
          {student.observations && (
            <p className="mt-3 text-sm text-muted-foreground border rounded-lg px-3 py-2">
              <span className="font-medium">Observaciones:</span> {student.observations}
            </p>
          )}
        </section>

        {/* Métricas sociales */}
        {metrics && (
          <section className="mb-8">
            <h3 className="text-base font-bold mb-3 pb-1 border-b">Métricas sociales</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              {[
                { label: "Elecciones recibidas", value: metrics.received_count ?? 0 },
                { label: "Elecciones realizadas", value: metrics.given_count ?? 0 },
                { label: "Pares recíprocos", value: metrics.reciprocal_count ?? 0 },
                { label: "Centralidad", value: metrics.centrality != null ? (metrics.centrality as number).toFixed(3) : "—" },
              ].map(({ label, value }) => (
                <div key={label} className="border rounded-lg px-3 py-2 text-center">
                  <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                  <p className="font-semibold">{value}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Relaciones recíprocas */}
        {reciprocalIds.length > 0 && (
          <section className="mb-8">
            <h3 className="text-base font-bold mb-3 pb-1 border-b">
              Relaciones recíprocas ({reciprocalIds.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {reciprocalIds.map(rid => {
                const s = studentMap.get(rid)
                return (
                  <span key={rid} className="inline-block border rounded-full px-3 py-1 text-sm font-medium">
                    {s ? `${s.first_name} ${s.last_name}` : rid}
                    {s && <span className="text-muted-foreground font-normal ml-1">({s.current_class})</span>}
                  </span>
                )
              })}
            </div>
          </section>
        )}

        {/* Elecciones realizadas */}
        <section className="mb-8 break-inside-avoid">
          <h3 className="text-base font-bold mb-3 pb-1 border-b">
            Ha elegido ({givenByTarget.size} compañeros)
          </h3>
          {givenByTarget.size === 0 ? (
            <p className="text-sm text-muted-foreground">No ha realizado ninguna elección.</p>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-3 py-2 border">Compañero/a</th>
                  <th className="text-left px-3 py-2 border">Clase</th>
                  <th className="text-left px-3 py-2 border">Tipo de relación</th>
                  <th className="text-center px-3 py-2 border">Recíproca</th>
                </tr>
              </thead>
              <tbody>
                {[...givenByTarget.entries()].map(([targetId, types]) => {
                  const target = studentMap.get(targetId)
                  const isReciprocal = reciprocalIds.includes(targetId)
                  return (
                    <tr key={targetId} className={isReciprocal ? "bg-green-50" : ""}>
                      <td className="px-3 py-1.5 border font-medium">
                        {target ? `${target.first_name} ${target.last_name}` : targetId}
                      </td>
                      <td className="px-3 py-1.5 border text-muted-foreground">
                        {target?.current_class ?? "—"}
                      </td>
                      <td className="px-3 py-1.5 border">
                        {types.map(t => RELATION_LABELS[t] ?? t).join(", ")}
                      </td>
                      <td className="px-3 py-1.5 border text-center">
                        {isReciprocal ? "✓" : ""}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </section>

        {/* Ha sido elegido por */}
        <section className="mb-8 break-inside-avoid">
          <h3 className="text-base font-bold mb-3 pb-1 border-b">
            Ha sido elegido por ({receivedByRespondent.size} compañeros)
          </h3>
          {receivedByRespondent.size === 0 ? (
            <p className="text-sm text-destructive font-medium">
              Ningún compañero ha elegido a este alumno.
            </p>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-3 py-2 border">Compañero/a</th>
                  <th className="text-left px-3 py-2 border">Clase</th>
                  <th className="text-left px-3 py-2 border">Tipo de relación</th>
                  <th className="text-center px-3 py-2 border">Recíproca</th>
                </tr>
              </thead>
              <tbody>
                {[...receivedByRespondent.entries()].map(([respondentId, types]) => {
                  const respondent = studentMap.get(respondentId)
                  const isReciprocal = reciprocalIds.includes(respondentId)
                  return (
                    <tr key={respondentId} className={isReciprocal ? "bg-green-50" : ""}>
                      <td className="px-3 py-1.5 border font-medium">
                        {respondent ? `${respondent.first_name} ${respondent.last_name}` : respondentId}
                      </td>
                      <td className="px-3 py-1.5 border text-muted-foreground">
                        {respondent?.current_class ?? "—"}
                      </td>
                      <td className="px-3 py-1.5 border">
                        {types.map(t => RELATION_LABELS[t] ?? t).join(", ")}
                      </td>
                      <td className="px-3 py-1.5 border text-center">
                        {isReciprocal ? "✓" : ""}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </section>

        {/* Asignación en propuestas */}
        {(proposals ?? []).length > 0 && (
          <section className="mb-8 break-inside-avoid">
            <h3 className="text-base font-bold mb-3 pb-1 border-b">Asignación en propuestas</h3>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-3 py-2 border">Propuesta</th>
                  <th className="text-center px-3 py-2 border">Clase asignada</th>
                  <th className="text-center px-3 py-2 border">Estado</th>
                </tr>
              </thead>
              <tbody>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {(proposals ?? []).map((p: any) => (
                  <tr key={p.id}>
                    <td className="px-3 py-1.5 border">{p.name}</td>
                    <td className="px-3 py-1.5 border text-center font-mono font-bold">
                      {p.proposal_assignments?.[0]?.target_class ?? "—"}
                    </td>
                    <td className="px-3 py-1.5 border text-center">
                      {p.status === "aprobada" ? "✓ Aprobada" : "Borrador"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* Footer */}
        <div className="mt-8 pt-4 border-t text-xs text-muted-foreground">
          <p>Informe generado por ClassMixer · {today} · Solo para uso interno del centro educativo.</p>
          <p className="mt-1">
            Documento confidencial. Contiene datos de un menor. Trátalo conforme al RGPD.
          </p>
          {!canSeeSensitive && (
            <p className="mt-1 italic">
              Nota: Los datos de apoyo emocional y conflictos no son visibles con el rol actual.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
