import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/auth"
import { notFound } from "next/navigation"
import Link from "next/link"
import PrintButton from "./PrintButton"
import { calculateSociogram } from "@/lib/sociogram/calculate"
import { getQuestionCatalogIndex } from "@/lib/questionnaire/catalog"
import { filterVisibleResponses } from "@/lib/questionnaire/visibility"
import type { UserRole } from "@/types"

const CDC_LABEL: Record<string, string> = {
  popular: "Popular",
  rechazado: "Rechazado",
  ignorado: "Ignorado",
  controvertido: "Controvertido",
  promedio: "Promedio",
}
const CDC_DESCRIPTION: Record<string, string> = {
  popular:       "Alto agrado social y alta visibilidad. Muchos compañeros le eligen, pocas o ninguna nominación de rechazo.",
  rechazado:     "Recibe nominaciones de rechazo activo explícitas del grupo. Perfil distinto al alumno tímido o aislado: es excluido activamente.",
  ignorado:      "Baja visibilidad social (pocos votos positivos Y pocos negativos). Invisible para el grupo, no conflictivo. Riesgo de soledad crónica.",
  controvertido: "Alto impacto polarizador: recibe muchos votos positivos Y negativos. Figura de liderazgo con tensión social.",
  promedio:      "Posición social dentro de la media del grupo. Sin riesgos específicos detectados.",
}
const CDC_COLOR: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  popular:       { bg: "bg-green-50",  border: "border-green-200",  text: "text-green-800",  badge: "bg-green-100 text-green-800" },
  rechazado:     { bg: "bg-red-50",    border: "border-red-300",    text: "text-red-900",    badge: "bg-red-100 text-red-900" },
  ignorado:      { bg: "bg-slate-50",  border: "border-slate-200",  text: "text-slate-700",  badge: "bg-slate-100 text-slate-700" },
  controvertido: { bg: "bg-amber-50",  border: "border-amber-200",  text: "text-amber-800",  badge: "bg-amber-100 text-amber-800" },
  promedio:      { bg: "bg-blue-50",   border: "border-blue-200",   text: "text-blue-800",   badge: "bg-blue-100 text-blue-700" },
}
const RELATION_LABELS: Record<string, string> = {
  friendship: "Amistad",
  work: "Trabajo en clase",
  emotional: "Apoyo emocional",
  negative: "Conflicto/dificultad",
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
    { data: allResponses },
    { data: proposals },
  ] = await Promise.all([
    supabase.from("processes").select("name, school_year, source_level, target_level").eq("id", processId).single(),
    supabase.from("students").select("*").eq("id", studentId).eq("process_id", processId).single(),
    supabase.from("students").select("*").eq("process_id", processId).eq("active", true),
    supabase.from("responses").select("*").eq("process_id", processId),
    supabase.from("proposals")
      .select("id, name, status, proposal_assignments!inner(target_class)")
      .eq("process_id", processId)
      .eq("proposal_assignments.student_id", studentId),
  ])

  if (!student || !process) notFound()

  type StudentRecord = typeof student & {
    external_id: string | null; gender: string | null; average_grade: number | null
    academic_level: string | null; behavior_level: string | null
    needs_type: string | null; observations: string | null
    excluded_from_mix?: boolean
  }
  const st = student as StudentRecord

  // ── Live sociogram calculation ─────────────────────────────────────────────
  const catalogIndex = await getQuestionCatalogIndex(profile.center_id)
  const visibleResponses = filterVisibleResponses(
    allResponses ?? [],
    profile.role as UserRole,
    catalogIndex.sensitivity,
  )
  const students = (allStudents ?? []).filter((s) => !(s as StudentRecord).excluded_from_mix)
  const soc = calculateSociogram(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    students as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    visibleResponses as any,
    catalogIndex.scoringRoles.friendshipLike,
    catalogIndex.excludedFromGraph,
    catalogIndex.scoringRoles.negativeLike,
  )

  const node = soc.nodes.find(n => n.id === studentId)
  const nodeMap = new Map(soc.nodes.map(n => [n.id, n]))
  const status = node?.sociometric_status ?? null
  const cdcColors = status ? CDC_COLOR[status] : CDC_COLOR.promedio

  // Edges for this student
  const outgoingFriendship = soc.edges.filter(e => e.source === studentId && e.relation_type === "friendship")
  const incomingFriendship = soc.edges.filter(e => e.target === studentId && e.relation_type === "friendship")
  const reciprocalIds = outgoingFriendship.filter(e => e.is_reciprocal).map(e => e.target)

  // All responses (for showing relation types)
  const givenByTarget = new Map<string, string[]>()
  const receivedByRespondent = new Map<string, string[]>()
  type ResponseRow = { respondent_student_id: string; target_student_id: string; relation_type: string }
  for (const r of visibleResponses) {
    const rr = r as ResponseRow
    if (rr.respondent_student_id === studentId) {
      if (!givenByTarget.has(rr.target_student_id)) givenByTarget.set(rr.target_student_id, [])
      givenByTarget.get(rr.target_student_id)!.push(rr.relation_type)
    }
    if (rr.target_student_id === studentId) {
      if (!receivedByRespondent.has(rr.respondent_student_id)) receivedByRespondent.set(rr.respondent_student_id, [])
      receivedByRespondent.get(rr.respondent_student_id)!.push(rr.relation_type)
    }
  }

  // Community members (excluding self)
  const communityId = node?.community_id ?? null
  const communityPeers = communityId !== null
    ? soc.nodes.filter(n => n.id !== studentId && n.community_id === communityId)
    : []

  // ── Recommendation paragraph ───────────────────────────────────────────────
  const rej = node?.rejection_received_count ?? 0
  const isBullyingRisk = status === "rechazado" && rej >= 5

  function buildRecommendation(): string {
    if (!node) return "Sin datos sociométricos disponibles. El cuestionario puede no haber sido completado."

    if (isBullyingRisk) {
      const rejectors = soc.edges
        .filter(e => e.target === studentId && e.relation_type === "negative")
        .map(e => nodeMap.get(e.source)?.first_name).filter(Boolean)
      return `RIESGO ALTO: ${rej} nominaciones de rechazo activo (umbral protocolo ≥5). ` +
        `Activar protocolo de convivencia antes de cualquier decisión de mezcla. ` +
        (rejectors.length > 0 ? `No asignar con: ${rejectors.join(", ")}. ` : "") +
        (reciprocalIds.length > 0
          ? `Mantener junto a su único vínculo positivo recíproco: ${reciprocalIds.map(id => nodeMap.get(id)?.first_name).filter(Boolean).join(", ")}.`
          : outgoingFriendship.length > 0
            ? `Intentar asignar con alguien de sus elecciones positivas: ${outgoingFriendship.map(e => nodeMap.get(e.target)?.first_name).filter(Boolean).join(", ")}.`
            : "Sin vínculos positivos identificados — intervención de orientación urgente.")
    }

    if (status === "rechazado") {
      return `Rechazo social activo (${rej} nominación/es de rechazo). ` +
        (reciprocalIds.length > 0
          ? `Mantener junto a ${reciprocalIds.map(id => nodeMap.get(id)?.first_name).filter(Boolean).join(", ")} (vínculo recíproco).`
          : outgoingFriendship.length > 0
            ? `Sin reciprocidades. Asignar con una de sus elecciones: ${outgoingFriendship.map(e => nodeMap.get(e.target)?.first_name).filter(Boolean).join(", ")}.`
            : "Sin vínculos positivos — añadir perfil prosocial en su equipo.")
    }

    if (node.is_isolated) {
      const chose = outgoingFriendship.map(e => nodeMap.get(e.target)?.first_name).filter(Boolean)
      const choosers = incomingFriendship.map(e => nodeMap.get(e.source)?.first_name).filter(Boolean)
      if (chose.length > 0)
        return `Aislado: no recibe elecciones pero sí eligió a ${chose.join(", ")}. Asignar con uno de ellos.`
      if (choosers.length > 0)
        return `Aislado: no eligió a nadie pero ${choosers.join(", ")} le eligieron. Colocar con uno de ellos.`
      return "Aislado sin ninguna conexión. Crear regla protect_vulnerable y asignar junto a un perfil prosocial."
    }

    if (status === "ignorado") {
      const chose = outgoingFriendship.map(e => nodeMap.get(e.target)?.first_name).filter(Boolean)
      return `Perfil silencioso (ignorado CDC): baja visibilidad sin conflicto activo. ` +
        (reciprocalIds.length > 0
          ? `Mantener junto a ${reciprocalIds.map(id => nodeMap.get(id)?.first_name).filter(Boolean).join(", ")}.`
          : chose.length > 0
            ? `Sin reciprocidades. Asignar con una de sus elecciones: ${chose.join(", ")}.`
            : "Sin vínculos. Integrar en subgrupo con alumno popular prosocial.")
    }

    if (node.is_vulnerable) {
      const chose = outgoingFriendship.map(e => nodeMap.get(e.target)?.first_name).filter(Boolean)
      if (reciprocalIds.length > 0)
        return `Vínculo social frágil. No separar de ${reciprocalIds.map(id => nodeMap.get(id)?.first_name).filter(Boolean).join(", ")} (único ancla afectiva).`
      return `Sin reciprocidades, baja visibilidad. Asignar con una de sus elecciones positivas: ${chose.join(", ") || "—"}.`
    }

    if (node.is_bridge) {
      return `Alumno puente (intermediación ${(node.betweenness * 100).toFixed(1)}%): conecta subgrupos distintos. ` +
        `Distribuir en la clase con mayor heterogeneidad social para preservar la conectividad global.`
    }

    if (status === "popular") {
      return `Alumno popular (zSP=${node.social_preference_z.toFixed(2)}): alta aceptación prosocial. ` +
        `Repartir entre clases como facilitador de integración — bajo riesgo al separar de sus vínculos actuales.`
    }

    if (status === "controvertido") {
      return `Alumno controvertido (alto impacto polarizador): no juntar con otros controvertidos. ` +
        `Asignar uno por clase para redirigir su liderazgo.`
    }

    return `Posición social estable. Sin restricciones especiales para la mezcla.`
  }

  const recommendation = buildRecommendation()
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
          {canSeeSensitive && (status === "rechazado" || status === "ignorado" || status === "controvertido") && (
            <Link
              href={`/processes/${processId}/students/${studentId}/intervention`}
              className="px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 transition-colors"
            >
              Ficha de Intervención
            </Link>
          )}
          <PrintButton />
        </div>
      </div>

      <div className="px-10 py-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold mb-1">
              {student.first_name} {student.last_name}
            </h2>
            <p className="text-muted-foreground text-sm">
              {student.current_class} · {st.external_id ?? "Sin ID"}
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

        {/* ── ESTADO CDC (siempre visible si hay datos) ── */}
        {status && node && (
          <div className={`mb-6 rounded-lg border-2 p-4 ${cdcColors.bg} ${cdcColors.border}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Estatus sociométrico CDC (Coie-Dodge)
              </span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cdcColors.badge}`}>
                {CDC_LABEL[status]}
              </span>
            </div>
            <p className={`text-sm ${cdcColors.text}`}>{CDC_DESCRIPTION[status]}</p>
            <div className="mt-3 grid grid-cols-4 gap-3 text-xs text-center">
              <div>
                <p className="text-muted-foreground">zSP (preferencia)</p>
                <p className="font-bold text-base">{node.social_preference_z.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">zSI (impacto)</p>
                <p className="font-bold text-base">{node.social_impact_z.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Intermediación</p>
                <p className="font-bold text-base">{(node.betweenness * 100).toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-muted-foreground">Centralidad</p>
                <p className="font-bold text-base">{(node.centrality * 100).toFixed(1)}%</p>
              </div>
            </div>
            {node.is_bridge && (
              <p className="mt-2 text-xs font-medium text-amber-700 bg-amber-100 rounded px-2 py-1 inline-block">
                Alumno puente — conecta subgrupos distintos
              </p>
            )}
          </div>
        )}

        {/* ── ALERTA DE RECHAZO ACTIVO ── */}
        {status === "rechazado" && node && (
          <div className={`mb-6 p-4 rounded-lg border-2 ${isBullyingRisk ? "bg-red-50 border-red-400" : "bg-red-50 border-red-200"}`}>
            <p className={`font-bold text-sm mb-1 ${isBullyingRisk ? "text-red-900" : "text-red-800"}`}>
              {isBullyingRisk
                ? `⚠ RIESGO DE EXCLUSIÓN SEVERA — ${rej} nominaciones de rechazo (umbral ≥5)`
                : `⚠ RECHAZO ACTIVO — ${rej} nominación/es de rechazo`}
            </p>
            <p className="text-sm text-red-800">
              Este alumno no es simplemente tímido o poco visible: recibe nominaciones
              explícitas de rechazo de sus compañeros.
              {isBullyingRisk && " Revisar protocolo de convivencia antes de cualquier decisión de mezcla."}
            </p>
            {canSeeSensitive && (
              <p className="text-xs text-red-700 mt-1">
                Rechazos recibidos: <strong>{rej}</strong> · Elecciones positivas recibidas: <strong>{node.received_count}</strong> · Recíprocas: <strong>{node.reciprocal_count}</strong>
              </p>
            )}
          </div>
        )}

        {/* ── ALERTA AISLADO/VULNERABLE (no rechazado) ── */}
        {node && status !== "rechazado" && (node.is_isolated || node.is_vulnerable) && (
          <div className={`mb-6 p-3 rounded-lg border text-sm font-medium ${
            node.is_isolated
              ? "bg-red-50 border-red-200 text-red-800"
              : "bg-amber-50 border-amber-200 text-amber-800"
          }`}>
            {node.is_isolated
              ? "⚠ ALUMNO AISLADO: No ha recibido ninguna elección positiva de sus compañeros."
              : `⚠ ALUMNO VULNERABLE: ${node.reciprocal_count === 0 ? "Sin relaciones recíprocas" : "Solo " + node.reciprocal_count + " relación/es recíproca/s"}. Dependencia social alta.`}
          </div>
        )}

        {/* ── RECOMENDACIÓN PARA LA MEZCLA ── */}
        {node && (
          <div className="mb-6 bg-slate-50 border rounded-lg p-4">
            <h3 className="text-sm font-bold mb-1 text-slate-700 uppercase tracking-wide">
              Recomendación para la mezcla de clases
            </h3>
            <p className="text-sm text-slate-800">{recommendation}</p>
          </div>
        )}

        {/* ── DATOS ACADÉMICOS ── */}
        <section className="mb-8">
          <h3 className="text-base font-bold mb-3 pb-1 border-b">Datos académicos</h3>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-4 text-sm">
            {[
              { label: "Género", value: st.gender ?? "—" },
              { label: "Nota media", value: st.average_grade ? String(st.average_grade) : "—" },
              { label: "Nivel", value: st.academic_level ?? "—" },
              { label: "Conducta", value: st.behavior_level ?? "—" },
              { label: "Nec. educ.", value: st.needs_type ?? "—" },
            ].map(({ label, value }) => (
              <div key={label} className="border rounded-lg px-3 py-2 text-center">
                <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                <p className="font-semibold">{value}</p>
              </div>
            ))}
          </div>
          {st.observations && (
            <p className="mt-3 text-sm text-muted-foreground border rounded-lg px-3 py-2">
              <span className="font-medium">Observaciones:</span> {st.observations}
            </p>
          )}
        </section>

        {/* ── MÉTRICAS SOCIALES EN VIVO ── */}
        {node && (
          <section className="mb-8">
            <h3 className="text-base font-bold mb-3 pb-1 border-b">Métricas sociales</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              {[
                { label: "Elecciones recibidas", value: node.received_count },
                { label: "Elecciones realizadas", value: node.given_count },
                { label: "Pares recíprocos", value: node.reciprocal_count },
                { label: "Reciprocidad", value: `${(node.reciprocity_rate * 100).toFixed(0)}%` },
                ...(canSeeSensitive ? [
                  { label: "Rechazos recibidos", value: node.rejection_received_count ?? 0 },
                ] : []),
                { label: "Intermediación", value: `${(node.betweenness * 100).toFixed(1)}%` },
                { label: "Centralidad", value: `${(node.centrality * 100).toFixed(1)}%` },
                { label: "Subgrupo", value: communityId !== null ? `G${communityId + 1}` : "—" },
              ].map(({ label, value }) => (
                <div key={label} className="border rounded-lg px-3 py-2 text-center">
                  <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                  <p className="font-semibold">{String(value)}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── RELACIONES RECÍPROCAS ── */}
        {reciprocalIds.length > 0 && (
          <section className="mb-8">
            <h3 className="text-base font-bold mb-3 pb-1 border-b">
              Relaciones recíprocas ({reciprocalIds.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {reciprocalIds.map(rid => {
                const s = nodeMap.get(rid)
                return (
                  <span key={rid} className="inline-block border rounded-full px-3 py-1 text-sm font-medium bg-green-50 border-green-200 text-green-800">
                    {s ? `${s.first_name} ${s.last_name}` : rid}
                    {s && <span className="font-normal ml-1 text-green-600">({s.current_class})</span>}
                  </span>
                )
              })}
            </div>
          </section>
        )}

        {/* ── SUBGRUPO / COMUNIDAD ── */}
        {communityPeers.length > 0 && (
          <section className="mb-8">
            <h3 className="text-base font-bold mb-3 pb-1 border-b">
              Subgrupo detectado — G{(communityId ?? 0) + 1} ({communityPeers.length + 1} miembros)
            </h3>
            <div className="flex flex-wrap gap-2">
              {communityPeers.map(peer => (
                <span key={peer.id} className="inline-block border rounded-full px-3 py-1 text-sm text-slate-700">
                  {peer.first_name} {peer.last_name}
                  <span className="text-muted-foreground ml-1">({peer.current_class})</span>
                </span>
              ))}
            </div>
          </section>
        )}

        {/* ── HA ELEGIDO ── */}
        <section className="mb-8 break-inside-avoid">
          <h3 className="text-base font-bold mb-3 pb-1 border-b">
            Ha elegido ({givenByTarget.size} compañero/s)
          </h3>
          {givenByTarget.size === 0 ? (
            <p className="text-sm text-muted-foreground">No ha realizado ninguna elección.</p>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-3 py-2 border">Compañero/a</th>
                  <th className="text-left px-3 py-2 border">Clase</th>
                  <th className="text-left px-3 py-2 border">Tipo</th>
                  <th className="text-center px-3 py-2 border">Recíproca</th>
                </tr>
              </thead>
              <tbody>
                {[...givenByTarget.entries()].map(([targetId, types]) => {
                  const target = nodeMap.get(targetId)
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

        {/* ── HA SIDO ELEGIDO POR ── */}
        <section className="mb-8 break-inside-avoid">
          <h3 className="text-base font-bold mb-3 pb-1 border-b">
            Ha sido elegido por ({receivedByRespondent.size} compañero/s)
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
                  <th className="text-left px-3 py-2 border">Tipo</th>
                  <th className="text-center px-3 py-2 border">Recíproca</th>
                </tr>
              </thead>
              <tbody>
                {[...receivedByRespondent.entries()].map(([respondentId, types]) => {
                  const respondent = nodeMap.get(respondentId)
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

        {/* ── ASIGNACIÓN EN PROPUESTAS ── */}
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
              Nota: Los datos de apoyo emocional y conflictos/rechazos no son visibles con el rol actual.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
