/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, hasFullAccess, logAudit } from "@/lib/auth"
import { NextResponse } from "next/server"
import { calculateSociogram } from "@/lib/sociogram/calculate"
import { getQuestionCatalogIndex } from "@/lib/questionnaire/catalog"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: parentId } = await params
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (!hasFullAccess(profile.role) && profile.role !== "orientador") {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 })
  }

  const url = new URL(req.url)
  const followupId = url.searchParams.get("followup_id")
  if (!followupId) return NextResponse.json({ error: "followup_id requerido" }, { status: 400 })

  const supabase = createServiceClient()

  const [{ data: parent }, { data: followup }] = await Promise.all([
    supabase.from("processes").select("*").eq("id", parentId).eq("center_id", profile.center_id).single(),
    supabase.from("processes").select("*").eq("id", followupId).eq("center_id", profile.center_id).single(),
  ])

  if (!parent || !followup) return NextResponse.json({ error: "Proceso no encontrado" }, { status: 404 })
  if ((followup as any).parent_process_id !== parentId) {
    return NextResponse.json({ error: "El proceso de seguimiento no pertenece a este proceso" }, { status: 400 })
  }

  const catalogIndex = await getQuestionCatalogIndex(profile.center_id)

  const [
    { data: parentStudents },
    { data: parentResponses },
    { data: followupStudents },
    { data: followupResponses },
  ] = await Promise.all([
    supabase.from("students").select("*").eq("process_id", parentId).eq("active", true),
    supabase.from("responses").select("*").eq("process_id", parentId),
    supabase.from("students").select("*").eq("process_id", followupId).eq("active", true),
    supabase.from("responses").select("*").eq("process_id", followupId),
  ])

  const socBefore = calculateSociogram(
    (parentStudents ?? []) as any,
    (parentResponses ?? []) as any,
    catalogIndex.scoringRoles.friendshipLike,
    catalogIndex.excludedFromGraph,
    catalogIndex.scoringRoles.negativeLike,
  )

  const socAfter = calculateSociogram(
    (followupStudents ?? []) as any,
    (followupResponses ?? []) as any,
    catalogIndex.scoringRoles.friendshipLike,
    catalogIndex.excludedFromGraph,
    catalogIndex.scoringRoles.negativeLike,
  )

  // Match students by external_id (same student across processes)
  const beforeByExtId = new Map(
    (parentStudents ?? []).map((s: any) => [s.external_id ?? s.id, s])
  )
  const afterByExtId = new Map(
    (followupStudents ?? []).map((s: any) => [s.external_id ?? s.id, s])
  )
  const beforeNodeMap = new Map(socBefore.nodes.map((n: any) => [n.id, n]))
  const afterNodeByExtId = new Map(
    socAfter.nodes.map((n: any) => {
      const s = (followupStudents ?? []).find((st: any) => st.id === n.id) as any
      return [s?.external_id ?? n.id, n]
    })
  )

  const studentComparisons: any[] = []
  let isolatedBefore = 0
  let isolatedAfter = 0
  let recoveredCount = 0

  for (const [extId, beforeStudent] of beforeByExtId) {
    const afterStudent = afterByExtId.get(extId)
    if (!afterStudent) continue

    const beforeNode = beforeNodeMap.get(beforeStudent.id) as any
    const afterNode = afterNodeByExtId.get(extId) as any
    if (!beforeNode) continue

    const rcBefore = beforeNode.reciprocal_count ?? 0
    const rcAfter = afterNode?.reciprocal_count ?? 0
    const recvBefore = beforeNode.received_count ?? 0
    const recvAfter = afterNode?.received_count ?? 0
    const statusBefore = beforeNode.sociometric_status ?? "promedio"
    const statusAfter = afterNode?.sociometric_status ?? "promedio"
    const wasIsolated = beforeNode.is_isolated === true || recvBefore === 0
    const isIsolatedNow = !afterNode || afterNode.is_isolated === true || recvAfter === 0

    if (wasIsolated) isolatedBefore++
    if (isIsolatedNow) isolatedAfter++
    if (wasIsolated && !isIsolatedNow) recoveredCount++

    studentComparisons.push({
      student_id: beforeStudent.id,
      external_id: extId,
      name: `${beforeStudent.first_name} ${beforeStudent.last_name}`,
      current_class_before: beforeStudent.current_class,
      current_class_after: afterStudent.current_class,
      received_before: recvBefore,
      received_after: recvAfter,
      reciprocal_before: rcBefore,
      reciprocal_after: rcAfter,
      status_before: statusBefore,
      status_after: statusAfter,
      was_isolated: wasIsolated,
      is_isolated_now: isIsolatedNow,
      recovered: wasIsolated && !isIsolatedNow,
      delta_received: recvAfter - recvBefore,
      delta_reciprocal: rcAfter - rcBefore,
    })
  }

  const avgRecvBefore = socBefore.nodes.length > 0
    ? socBefore.nodes.reduce((s: number, n: any) => s + (n.received_count ?? 0), 0) / socBefore.nodes.length
    : 0
  const avgRecvAfter = socAfter.nodes.length > 0
    ? socAfter.nodes.reduce((s: number, n: any) => s + (n.received_count ?? 0), 0) / socAfter.nodes.length
    : 0

  await logAudit(profile.id, profile.center_id, "view_followup_compare", "process", {
    processId: parentId,
    metadata: { followupId, matched: studentComparisons.length, recovered: recoveredCount },
  })

  return NextResponse.json({
    parent: { id: parentId, name: parent.name, school_year: parent.school_year },
    followup: { id: followupId, name: followup.name, school_year: (followup as any).school_year },
    summary: {
      matched_students: studentComparisons.length,
      isolated_before: isolatedBefore,
      isolated_after: isolatedAfter,
      recovered_count: recoveredCount,
      avg_received_before: Math.round(avgRecvBefore * 10) / 10,
      avg_received_after: Math.round(avgRecvAfter * 10) / 10,
      total_alerts_before: socBefore.alerts.length,
      total_alerts_after: socAfter.alerts.length,
    },
    students: studentComparisons,
  })
}
