/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, hasFullAccess, logAudit } from "@/lib/auth"
import { NextResponse } from "next/server"
import { calculateSociogram } from "@/lib/sociogram/calculate"
import { getQuestionCatalogIndex } from "@/lib/questionnaire/catalog"
import { filterVisibleResponses } from "@/lib/questionnaire/visibility"
import type { UserRole } from "@/types"

export interface AlertItem {
  id: string
  student_id: string
  student_name: string
  current_class: string | null
  alert_type: "bullying_risk" | "cdc_rechazado" | "aislamiento" | "vulnerable" | "subgrupo_cerrado"
  severity: "urgente" | "alta" | "media"
  description: string
  metric?: number
  has_case: boolean
  case_status?: string
}

// GET /api/processes/[id]/alerts — full alert report for a process
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (!hasFullAccess(profile.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 })

  const { id } = await params
  const supabase = createServiceClient()

  const { data: process } = await supabase
    .from("processes")
    .select("center_id, name")
    .eq("id", id)
    .eq("center_id", profile.center_id)
    .single()
  if (!process) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  const [{ data: allStudents }, { data: allResponses }, { data: existingCases }] = await Promise.all([
    supabase.from("students").select("*").eq("process_id", id).eq("active", true),
    supabase.from("responses").select("*").eq("process_id", id),
    (supabase as any).from("intervention_cases").select("student_id, status").eq("process_id", id),
  ])

  const catalogIndex = await getQuestionCatalogIndex(profile.center_id)
  const responses = filterVisibleResponses(
    allResponses ?? [],
    profile.role as UserRole,
    catalogIndex.sensitivity,
  )

  const soc = calculateSociogram(
    (allStudents ?? []) as any,
    responses as any,
    catalogIndex.scoringRoles.friendshipLike,
    catalogIndex.excludedFromGraph,
    catalogIndex.scoringRoles.negativeLike,
  )

  const caseMap = new Map(
    ((existingCases ?? []) as { student_id: string; status: string }[])
      .map(c => [c.student_id, c.status])
  )

  const alerts: AlertItem[] = []

  for (const node of soc.nodes) {
    const has_case = caseMap.has(node.id)
    const case_status = caseMap.get(node.id)
    const name = `${node.first_name ?? ""} ${node.last_name ?? ""}`.trim()

    // Bullying risk (≥5 rejections)
    if ((node.rejection_received_count ?? 0) >= 5) {
      alerts.push({
        id: `bullying_${node.id}`,
        student_id: node.id,
        student_name: name,
        current_class: node.current_class ?? null,
        alert_type: "bullying_risk",
        severity: "urgente",
        description: `Recibe ${node.rejection_received_count} nominaciones de rechazo. Criterio de riesgo de acoso escolar superado.`,
        metric: node.rejection_received_count,
        has_case,
        case_status,
      })
      continue
    }

    // CDC Rechazado
    if (node.sociometric_status === "rechazado") {
      alerts.push({
        id: `rechazado_${node.id}`,
        student_id: node.id,
        student_name: name,
        current_class: node.current_class ?? null,
        alert_type: "cdc_rechazado",
        severity: "alta",
        description: `CDC: Estatus rechazado (zSP = ${node.social_preference_z?.toFixed(2) ?? "—"}, ${node.rejection_received_count ?? 0} rechazos). Requiere atención del orientador.`,
        metric: node.rejection_received_count,
        has_case,
        case_status,
      })
      continue
    }

    // Aislamiento total
    if (node.is_isolated && !node.sociometric_status) {
      alerts.push({
        id: `aislado_${node.id}`,
        student_id: node.id,
        student_name: name,
        current_class: node.current_class ?? null,
        alert_type: "aislamiento",
        severity: "alta",
        description: `Sin elecciones recibidas y sin conexiones recíprocas. Riesgo de exclusión social.`,
        metric: node.received_count,
        has_case,
        case_status,
      })
      continue
    }

    // Vulnerable (rechazado already handled above with continue)
    if (node.is_vulnerable) {
      alerts.push({
        id: `vulnerable_${node.id}`,
        student_id: node.id,
        student_name: name,
        current_class: node.current_class ?? null,
        alert_type: "vulnerable",
        severity: "media",
        description: `Solo ${node.reciprocal_count ?? 0} relación/es recíproca/s. Depende de un único vínculo social.`,
        metric: node.reciprocal_count,
        has_case,
        case_status,
      })
    }
  }

  // Closed subgroups
  for (const community of soc.communities.filter(c => c.is_closed && c.size >= 5)) {
    const memberNames = community.members
      .slice(0, 3)
      .map(mid => {
        const n = soc.nodes.find(n => n.id === mid)
        return n ? n.first_name : "?"
      })
      .join(", ")
    alerts.push({
      id: `subgrupo_${community.id}`,
      student_id: community.members[0],
      student_name: `Subgrupo (${memberNames}…)`,
      current_class: null,
      alert_type: "subgrupo_cerrado",
      severity: "media",
      description: `Subgrupo cerrado de ${community.size} miembros con escasa conexión exterior. Revisar dinámicas de exclusión.`,
      metric: community.size,
      has_case: false,
    })
  }

  // Sort: urgente first, then by metric desc
  alerts.sort((a, b) => {
    const sev = { urgente: 0, alta: 1, media: 2 }
    if (sev[a.severity] !== sev[b.severity]) return sev[a.severity] - sev[b.severity]
    return (b.metric ?? 0) - (a.metric ?? 0)
  })

  await logAudit(profile.id, profile.center_id, "view_alerts", "process", { processId: id })
  return NextResponse.json({ alerts, total: alerts.length, urgent: alerts.filter(a => a.severity === "urgente").length })
}