import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, logAudit } from "@/lib/auth"
import { notFound } from "next/navigation"
import Link from "next/link"
import { calculateSociogram } from "@/lib/sociogram/calculate"
import { getQuestionCatalogIndex } from "@/lib/questionnaire/catalog"

type StudentRecord = {
  id: string
  first_name: string
  last_name: string
  current_class: string
  external_id?: string | null
  gender?: string | null
  average_grade?: number | null
  academic_level?: string | null
  behavior_level?: string | null
  needs_type?: string | null
  observations?: string | null
}
type ResponseRow = { respondent_student_id: string; target_student_id: string; relation_type: string }

const STATUS_ES: Record<string, string> = {
  popular: "Popular",
  rechazado: "Rechazado",
  ignorado: "Ignorado",
  controvertido: "Controvertido",
  promedio: "Promedio",
}

const STATUS_DESCRIPTION: Record<string, string> = {
  rechazado:
    "El alumno recibe nominaciones de rechazo activo por parte del grupo. Este perfil es diferente al alumno tímido o al que no tiene amigos: es excluido de forma intencional.",
  ignorado:
    "El alumno tiene baja visibilidad social: ni le eligen ni le rechazan activamente. Invisible para el grupo. Riesgo de soledad crónica sin señales externas claras.",
  controvertido:
    "El alumno genera una respuesta polarizada en el grupo: recibe muchas elecciones positivas y también muchas negativas. Figura de liderazgo con tensión social latente.",
}

export default async function InterventionPage({
  params,
}: {
  params: Promise<{ id: string; studentId: string }>
}) {
  const { id: processId, studentId } = await params
  const profile = await getUserProfile()
  if (!profile) notFound()

  // Gated to admin/orientador only
  if (!["admin", "superadmin", "orientador"].includes(profile.role)) notFound()

  const supabase = createServiceClient()

  const [
    { data: process },
    { data: student },
    { data: allStudents },
    { data: allResponses },
  ] = await Promise.all([
    supabase.from("processes").select("name, school_year, source_level, target_level, center_id").eq("id", processId).single(),
    supabase.from("students").select("*").eq("id", studentId).eq("process_id", processId).single(),
    supabase.from("students").select("*").eq("process_id", processId).eq("active", true),
    supabase.from("responses").select("*").eq("process_id", processId),
  ])

  if (!student || !process) notFound()

  const catalogIndex = await getQuestionCatalogIndex(profile.center_id)
  const st = student as StudentRecord

  const eligibleStudents = (allStudents ?? []).filter(
    (s) => !(s as StudentRecord & { excluded_from_mix?: boolean }).excluded_from_mix
  )

  const soc = calculateSociogram(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    eligibleStudents as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (allResponses ?? []) as any,
    catalogIndex.scoringRoles.friendshipLike,
    catalogIndex.excludedFromGraph,
    catalogIndex.scoringRoles.negativeLike,
  )

  const node = soc.nodes.find((n) => n.id === studentId)
  const nodeMap = new Map(soc.nodes.map((n) => [n.id, n]))
  const status = node?.sociometric_status ?? null
  const rej = node?.rejection_received_count ?? 0
  const isBullyingRisk = status === "rechazado" && rej >= 5

  // Reject/ignore/controversial only — redirect otherwise
  const requiresIntervention = status === "rechazado" || status === "ignorado" || status === "controvertido" || isBullyingRisk
  if (!requiresIntervention && node) notFound()

  // Log audit access
  await logAudit(profile.id, profile.center_id, "view_intervention_ficha", "student", {
    processId,
    entityId: studentId,
  })

  const outgoing = (soc.edges.filter((e) => e.source === studentId && e.relation_type === "friendship") ?? [])
  const incoming = (soc.edges.filter((e) => e.target === studentId && e.relation_type === "friendship") ?? [])
  const reciprocal = outgoing.filter((e) => e.is_reciprocal)

  const rejectorsEdges = (soc.edges.filter((e) => e.target === studentId && e.relation_type === "negative") ?? [])
  const rejectors = rejectorsEdges.map((e) => nodeMap.get(e.source)).filter(Boolean)

  const responses = allResponses as ResponseRow[] | null ?? []
  const negByResponder = new Map<string, number>()
  for (const r of responses) {
    if (r.target_student_id === studentId && r.relation_type === "negative") {
      negByResponder.set(r.respondent_student_id, (negByResponder.get(r.respondent_student_id) ?? 0) + 1)
    }
  }

  const today = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })
  const communityId = node?.community_id ?? null
  const communityPeers = communityId !== null
    ? soc.nodes.filter((n) => n.id !== studentId && n.community_id === communityId).slice(0, 8)
    : []

  const totalStudents = soc.nodes.length
  const totalReciprocals = reciprocal.length

  return (
    <div className="bg-white text-black min-h-screen">
      {/* Toolbar */}
      <div className="print:hidden sticky top-0 z-10 flex items-center justify-between px-8 py-3 bg-white border-b shadow-sm">
        <div>
          <h1 className="font-bold text-sm text-gray-900">
            Ficha de Intervención — {st.first_name} {st.last_name}
          </h1>
          <p className="text-xs text-gray-500">{process.name} · {process.school_year}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/processes/${processId}/students/${studentId}/report`}
            className="text-sm text-gray-500 hover:text-gray-800 underline"
          >
            ← Informe individual
          </Link>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
          >
            Imprimir / PDF
          </button>
        </div>
      </div>

      <div className="px-10 py-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-red-700 bg-red-100 px-2 py-0.5 rounded">
                FICHA DE INTERVENCIÓN — USO INTERNO
              </span>
              {isBullyingRisk && (
                <span className="text-xs font-bold uppercase tracking-wider text-white bg-red-600 px-2 py-0.5 rounded">
                  ⚠ RIESGO ACOSO
                </span>
              )}
            </div>
            <h2 className="text-2xl font-bold text-gray-900">
              {st.first_name} {st.last_name}
            </h2>
            <p className="text-gray-500 text-sm">
              {st.current_class}
              {st.external_id ? ` · ID: ${st.external_id}` : ""}
              {st.gender ? ` · ${st.gender}` : ""}
            </p>
            <p className="text-gray-500 text-sm mt-0.5">
              {process.name} · Curso {process.school_year}
            </p>
          </div>
          <div className="text-right text-sm text-gray-500">
            <p>Generado: {today}</p>
            <p className="text-xs mt-1">Orientación / Dirección</p>
            <p className="text-xs">Documento confidencial</p>
          </div>
        </div>

        {/* ── DIAGNÓSTICO CDC ── */}
        <section className="mb-6 p-5 border-2 border-red-200 rounded-xl bg-red-50">
          <h3 className="font-bold text-base text-gray-900 mb-3">Diagnóstico sociométrico (CDC)</h3>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl font-bold text-red-800">
              {status ? STATUS_ES[status] : "Sin datos"}
            </span>
            {isBullyingRisk && (
              <span className="text-sm font-semibold text-red-700 bg-red-100 border border-red-300 px-3 py-1 rounded-full">
                ⚠ Riesgo de acoso (≥5 rechazos)
              </span>
            )}
          </div>
          {status && STATUS_DESCRIPTION[status] && (
            <p className="text-sm text-gray-700">{STATUS_DESCRIPTION[status]}</p>
          )}

          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="bg-white rounded-lg p-3 border border-red-100 text-center">
              <p className="text-2xl font-bold text-red-700">{rej}</p>
              <p className="text-xs text-gray-500">Nominaciones de rechazo recibidas</p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-gray-100 text-center">
              <p className="text-2xl font-bold text-blue-700">{node?.received_count ?? 0}</p>
              <p className="text-xs text-gray-500">Elecciones positivas recibidas</p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-gray-100 text-center">
              <p className="text-2xl font-bold text-green-700">{totalReciprocals}</p>
              <p className="text-xs text-gray-500">Relaciones recíprocas</p>
            </div>
          </div>

          <div className="mt-3 text-xs text-gray-500">
            Percentil social: zSP = {node?.social_preference_z?.toFixed(2) ?? "—"} ·
            zSI = {node?.social_impact_z?.toFixed(2) ?? "—"} ·
            N total = {totalStudents} alumnos
          </div>
        </section>

        {/* ── NOMINACIONES DE RECHAZO ── */}
        {rejectors.length > 0 && (
          <section className="mb-6 p-5 border border-orange-200 rounded-xl bg-orange-50">
            <h3 className="font-bold text-base text-gray-900 mb-3">
              Nominaciones de rechazo recibidas ({rejectors.length})
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              Estos compañeros le nominaron en la pregunta de dificultad de trabajo o rechazo.
              Información confidencial — no compartir con el alumno.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {rejectors.map((r) => r && (
                <div key={r.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-orange-100 text-sm">
                  <span className="font-medium text-gray-800">{r.first_name} {r.last_name}</span>
                  <span className="text-gray-500 text-xs">{r.current_class}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-red-700 font-medium mt-3">
              → No asignar en la misma clase en la propuesta de mezcla.
            </p>
          </section>
        )}

        {/* ── VÍNCULOS POSITIVOS ── */}
        <section className="mb-6 p-5 border border-green-200 rounded-xl bg-green-50">
          <h3 className="font-bold text-base text-gray-900 mb-3">Vínculos positivos</h3>

          {reciprocal.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-semibold text-green-700 mb-2">Amistades recíprocas (proteger en la mezcla):</p>
              <div className="flex flex-wrap gap-2">
                {reciprocal.map((e) => {
                  const peer = nodeMap.get(e.target)
                  if (!peer) return null
                  return (
                    <div key={e.target} className="flex items-center gap-1.5 bg-white border border-green-200 rounded-lg px-3 py-1.5 text-sm">
                      <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                      <span className="font-medium text-gray-800">{peer.first_name} {peer.last_name}</span>
                      <span className="text-gray-400 text-xs">({peer.current_class})</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {outgoing.filter((e) => !e.is_reciprocal).length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-semibold text-gray-600 mb-2">Eligió pero no fue correspondido/a:</p>
              <div className="flex flex-wrap gap-2">
                {outgoing.filter((e) => !e.is_reciprocal).map((e) => {
                  const peer = nodeMap.get(e.target)
                  if (!peer) return null
                  return (
                    <div key={e.target} className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
                      <span className="w-2 h-2 rounded-full bg-gray-400 inline-block" />
                      <span className="text-gray-700">{peer.first_name} {peer.last_name}</span>
                      <span className="text-gray-400 text-xs">({peer.current_class})</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {incoming.filter((e) => !e.is_reciprocal).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-2">Le eligieron pero no correspondió:</p>
              <div className="flex flex-wrap gap-2">
                {incoming.filter((e) => !e.is_reciprocal).map((e) => {
                  const peer = nodeMap.get(e.source)
                  if (!peer) return null
                  return (
                    <div key={e.source} className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
                      <span className="text-gray-700">{peer.first_name} {peer.last_name}</span>
                      <span className="text-gray-400 text-xs">({peer.current_class})</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {outgoing.length === 0 && incoming.length === 0 && (
            <p className="text-sm text-gray-500 italic">
              Sin vínculos positivos identificados. Intervención de orientación urgente antes de la mezcla.
            </p>
          )}
        </section>

        {/* ── GRUPO SOCIAL (COMUNIDAD) ── */}
        {communityPeers.length > 0 && (
          <section className="mb-6 p-5 border border-gray-200 rounded-xl">
            <h3 className="font-bold text-base text-gray-900 mb-2">Grupo social detectado (comunidad #{communityId})</h3>
            <p className="text-xs text-gray-500 mb-3">
              Alumnos que el algoritmo agrupa en la misma comunidad sociométrica.
              Puede ser útil para entender el contexto social del alumno.
            </p>
            <div className="flex flex-wrap gap-2">
              {communityPeers.map((peer) => (
                <div key={peer.id} className="text-xs px-2 py-1 bg-gray-50 border border-gray-200 rounded-md">
                  <span className="font-medium">{peer.first_name} {peer.last_name}</span>
                  <span className="text-gray-400 ml-1">({peer.current_class})</span>
                  {peer.sociometric_status === "popular" && <span className="ml-1 text-green-600">★</span>}
                  {peer.sociometric_status === "rechazado" && <span className="ml-1 text-red-600">⚠</span>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── DATOS ACADÉMICOS ── */}
        <section className="mb-6 p-5 border border-gray-200 rounded-xl">
          <h3 className="font-bold text-base text-gray-900 mb-3">Perfil académico y de convivencia</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            {st.average_grade != null && (
              <div>
                <p className="text-xs text-gray-500">Nota media</p>
                <p className="font-semibold text-gray-900">{st.average_grade}</p>
              </div>
            )}
            {st.academic_level && (
              <div>
                <p className="text-xs text-gray-500">Nivel académico</p>
                <p className="font-semibold text-gray-900">{st.academic_level}</p>
              </div>
            )}
            {st.behavior_level && (
              <div>
                <p className="text-xs text-gray-500">Conducta</p>
                <p className="font-semibold text-gray-900">{st.behavior_level}</p>
              </div>
            )}
            {st.needs_type && (
              <div>
                <p className="text-xs text-gray-500">Necesidades</p>
                <p className="font-semibold text-gray-900">{st.needs_type}</p>
              </div>
            )}
          </div>
          {st.observations && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-1">Observaciones</p>
              <p className="text-sm text-gray-700">{st.observations}</p>
            </div>
          )}
        </section>

        {/* ── RECOMENDACIONES DE MEZCLA ── */}
        <section className="mb-6 p-5 border-2 border-blue-200 rounded-xl bg-blue-50">
          <h3 className="font-bold text-base text-gray-900 mb-3">Recomendaciones para la propuesta de mezcla</h3>
          <div className="space-y-2 text-sm">
            {rejectors.length > 0 && (
              <div className="flex items-start gap-2">
                <span className="text-red-600 font-bold shrink-0">✗</span>
                <span className="text-gray-800">
                  <strong>NO asignar en la misma clase que:</strong>{" "}
                  {rejectors.map((r) => r && `${r.first_name} ${r.last_name}`).filter(Boolean).join(", ")}.
                </span>
              </div>
            )}
            {reciprocal.length > 0 && (
              <div className="flex items-start gap-2">
                <span className="text-green-600 font-bold shrink-0">✓</span>
                <span className="text-gray-800">
                  <strong>MANTENER junto a:</strong>{" "}
                  {reciprocal.map((e) => {
                    const p = nodeMap.get(e.target)
                    return p ? `${p.first_name} ${p.last_name}` : null
                  }).filter(Boolean).join(", ")} (vínculo recíproco).
                </span>
              </div>
            )}
            {outgoing.length > 0 && reciprocal.length === 0 && (
              <div className="flex items-start gap-2">
                <span className="text-blue-600 font-bold shrink-0">→</span>
                <span className="text-gray-800">
                  <strong>Asignar con al menos uno de sus elegidos:</strong>{" "}
                  {outgoing.map((e) => {
                    const p = nodeMap.get(e.target)
                    return p ? `${p.first_name} ${p.last_name}` : null
                  }).filter(Boolean).join(", ")}.
                </span>
              </div>
            )}
            {outgoing.length === 0 && (
              <div className="flex items-start gap-2">
                <span className="text-amber-600 font-bold shrink-0">⚠</span>
                <span className="text-gray-800">
                  Sin vínculos positivos identificados. Integrar en clase con perfil prosocial y evitar alumnos con historial de conflicto.
                </span>
              </div>
            )}
            {isBullyingRisk && (
              <div className="flex items-start gap-2 mt-2 pt-2 border-t border-blue-200">
                <span className="text-red-700 font-bold shrink-0">⚠</span>
                <span className="text-red-800 font-medium">
                  ACTIVAR PROTOCOLO DE CONVIVENCIA antes de la mezcla.
                  Consultar con el equipo de orientación y dirección.
                </span>
              </div>
            )}
          </div>
        </section>

        {/* ── NOTAS DE SEGUIMIENTO ── */}
        <section className="mb-8 p-5 border border-dashed border-gray-300 rounded-xl">
          <h3 className="font-bold text-base text-gray-900 mb-3">Notas de seguimiento (uso del equipo)</h3>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-500 mb-1">Acuerdos del equipo:</p>
              <div className="border-b border-gray-200 pb-6" />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Actuaciones planificadas:</p>
              <div className="border-b border-gray-200 pb-6" />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Fecha de revisión:</p>
              <div className="border-b border-gray-200 pb-4" />
            </div>
            <div className="flex justify-between text-xs text-gray-400 pt-2">
              <span>Responsable: ___________________________</span>
              <span>Firma: ___________________________</span>
            </div>
          </div>
        </section>

        {/* Footer */}
        <div className="text-xs text-gray-400 text-center border-t border-gray-100 pt-4">
          Documento confidencial generado por ClassMixer · {today} · Solo para uso interno del equipo docente y de orientación.
          No reproducir ni compartir sin autorización de la dirección del centro.
        </div>
      </div>
    </div>
  )
}
