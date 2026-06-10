import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, logAudit } from "@/lib/auth"
import { NextResponse } from "next/server"
import { generateProposals, DEFAULT_CONSTRAINTS } from "@/lib/algorithm/heuristic"
import { DEFAULT_WEIGHTS } from "@/lib/algorithm/weights"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id: proposalId } = await params
  const supabase = createServiceClient()

  // Fetch proposal + its process
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: proposal } = await (supabase as any)
    .from("proposals")
    .select("*, proposal_assignments(student_id, target_class, locked)")
    .eq("id", proposalId)
    .single() as { data: { process_id: string; proposal_assignments: { student_id: string; target_class: string; locked: boolean }[] } | null }

  if (!proposal) return NextResponse.json({ error: "Propuesta no encontrada" }, { status: 404 })

  // Verify ownership via process → center
  const { data: process } = await supabase
    .from("processes")
    .select("*")
    .eq("id", proposal.process_id)
    .single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proc = process as any
  if (!proc || proc.center_id !== profile.center_id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const targetClasses = proc.target_groups as string[]
  if (!targetClasses || targetClasses.length === 0) {
    return NextResponse.json({ error: "No hay grupos destino" }, { status: 400 })
  }

  const currentAssignments = proposal.proposal_assignments ?? []
  const lockedAssignments = currentAssignments.filter((a: { locked: boolean }) => a.locked)

  const [
    { data: students },
    { data: responses },
    { data: rules },
  ] = await Promise.all([
    supabase.from("students").select("*").eq("process_id", proposal.process_id).eq("active", true),
    supabase.from("responses").select("*").eq("process_id", proposal.process_id),
    supabase.from("rules").select("*, rule_students(student_id)").eq("process_id", proposal.process_id).eq("active", true),
  ])

  if (!students) return NextResponse.json({ error: "Alumnos no encontrados" }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rulesWithStudents = ((rules ?? []) as any[]).map((r: any) => ({
    ...r,
    students: r.rule_students?.map((rs: { student_id: string }) => ({ student_id: rs.student_id })) ?? [],
  }))

  // Inject synthetic lock rules for manually locked assignments
  const syntheticLockRules = lockedAssignments.map((a, i) => ({
    id: `__locked_${i}`,
    rule_type: "lock_student_to_class" as const,
    priority: "obligatoria" as const,
    active: true,
    target_class: a.target_class,
    students: [{ student_id: a.student_id }],
  }))

  const allRules = [...rulesWithStudents, ...syntheticLockRules]

  const proposals = generateProposals(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    students as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (responses ?? []) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    allRules as any,
    targetClasses,
    1,
    DEFAULT_WEIGHTS,
    DEFAULT_CONSTRAINTS
  )

  if (proposals.length === 0) {
    return NextResponse.json({ error: "No se pudo recalcular la propuesta" }, { status: 422 })
  }

  const newProposal = proposals[0]

  // Delete non-locked assignments and re-insert
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lockedIds = new Set(lockedAssignments.map((a: any) => a.student_id))
  const unlockedIds = currentAssignments
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((a: any) => !lockedIds.has(a.student_id))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((a: any) => a.student_id)

  if (unlockedIds.length > 0) {
    await supabase
      .from("proposal_assignments")
      .delete()
      .eq("proposal_id", proposalId)
      .in("student_id", unlockedIds)
  }

  const newUnlocked = newProposal.assignments.filter(a => !lockedIds.has(a.student_id))
  if (newUnlocked.length > 0) {
    await supabase.from("proposal_assignments").insert(
      newUnlocked.map(a => ({
        proposal_id: proposalId,
        student_id: a.student_id,
        target_class: a.target_class,
        locked: false,
      }))
    )
  }

  // Update proposal scores
  await supabase
    .from("proposals")
    .update({
      score_total: newProposal.score_total,
      score_social: newProposal.score_social,
      score_academic: newProposal.score_academic,
      score_gender: newProposal.score_gender,
      score_behavior: newProposal.score_behavior,
    })
    .eq("id", proposalId)

  // Recalculate metrics
  await supabase.from("proposal_metrics").delete().eq("proposal_id", proposalId)

  const metricRows: { proposal_id: string; metric_key: string; metric_value: number; target_class: string }[] = []
  for (const [cls, metrics] of Object.entries(newProposal.metrics)) {
    for (const [key, value] of Object.entries(metrics)) {
      metricRows.push({ proposal_id: proposalId, metric_key: key, metric_value: value, target_class: cls })
    }
  }
  if (metricRows.length > 0) {
    await supabase.from("proposal_metrics").insert(metricRows)
  }

  await logAudit(profile.id, profile.center_id, "recalculate_proposal", "proposal", {
    entityId: proposalId,
    metadata: { locked: lockedAssignments.length, recalculated: newUnlocked.length },
  })

  return NextResponse.json({
    success: true,
    score_total: newProposal.score_total,
    locked_kept: lockedAssignments.length,
    recalculated: newUnlocked.length,
  })
}
