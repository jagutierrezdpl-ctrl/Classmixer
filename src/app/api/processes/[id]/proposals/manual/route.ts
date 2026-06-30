import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, hasFullAccess, tutorCanAccessProcess, logAudit } from "@/lib/auth"
import { NextResponse } from "next/server"
import { scoreAssignments } from "@/lib/algorithm/heuristic"
import { DEFAULT_WEIGHTS } from "@/lib/algorithm/weights"
import { getQuestionCatalogIndex } from "@/lib/questionnaire/catalog"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params
  const supabase = createServiceClient()

  const { data: process } = await supabase
    .from("processes")
    .select("*")
    .eq("id", id)
    .single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proc = process as any
  if (!proc || proc.center_id !== profile.center_id) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  }
  if (!hasFullAccess(profile.role) && !(await tutorCanAccessProcess(profile.center_id, profile.id, id))) {
    return NextResponse.json({ error: "Sin acceso a este proceso" }, { status: 403 })
  }

  const body = await request.json()
  // assignments: [{ student_id, target_class }]
  const assignments: { student_id: string; target_class: string }[] = body.assignments ?? []
  const proposalName: string = body.name ?? "Lista manual"

  if (assignments.length === 0) {
    return NextResponse.json({ error: "Sin asignaciones" }, { status: 400 })
  }

  const targetClasses: string[] = proc.target_groups ?? []
  if (targetClasses.length === 0) {
    return NextResponse.json({ error: "No hay grupos destino configurados" }, { status: 400 })
  }

  const [
    { data: students },
    { data: responses },
    { data: rules },
  ] = await Promise.all([
    supabase.from("students").select("*").eq("process_id", id).eq("active", true),
    supabase.from("responses").select("*").eq("process_id", id),
    supabase.from("rules").select("*, rule_students(student_id)").eq("process_id", id).eq("active", true),
  ])

  if (!students) return NextResponse.json({ error: "Alumnos no encontrados" }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rulesWithStudents = ((rules ?? []) as any[]).map((r: any) => ({
    ...r,
    students: r.rule_students?.map((rs: { student_id: string }) => ({ student_id: rs.student_id })) ?? [],
  }))

  const catalogIndex = await getQuestionCatalogIndex(profile.center_id)

  // Score the manual distribution
  const scored = scoreAssignments(
    assignments,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    students as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (responses ?? []) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rulesWithStudents as any,
    targetClasses,
    DEFAULT_WEIGHTS,
    {
      friendshipLike: catalogIndex.scoringRoles.friendshipLike,
      workLike: catalogIndex.scoringRoles.workLike,
      negativeLike: catalogIndex.scoringRoles.negativeLike,
    }
  )

  const { data: saved } = await supabase
    .from("proposals")
    .insert({
      process_id: id,
      name: proposalName,
      score_total: scored.score_total,
      score_social: scored.score_social,
      score_academic: scored.score_academic,
      score_gender: scored.score_gender,
      score_behavior: scored.score_behavior,
      status: "generada",
      created_by: profile.id,
    })
    .select("id")
    .single()

  if (!saved) return NextResponse.json({ error: "Error al crear propuesta" }, { status: 500 })

  await supabase.from("proposal_assignments").insert(
    assignments.map(a => ({
      proposal_id: saved.id,
      student_id: a.student_id,
      target_class: a.target_class,
      locked: false,
    }))
  )

  const metricRows: { proposal_id: string; metric_key: string; metric_value: number; target_class: string | null }[] = [
    { proposal_id: saved.id, metric_key: "use_sociogram", metric_value: 1, target_class: null },
  ]
  for (const [cls, metrics] of Object.entries(scored.metrics)) {
    for (const [key, value] of Object.entries(metrics as Record<string, number>)) {
      metricRows.push({ proposal_id: saved.id, metric_key: key, metric_value: value, target_class: cls })
    }
  }
  await supabase.from("proposal_metrics").insert(metricRows)

  await supabase
    .from("processes")
    .update({ status: "propuestas_generadas", updated_at: new Date().toISOString() })
    .eq("id", id)

  await logAudit(profile.id, profile.center_id, "create_manual_proposal", "proposal", {
    processId: id,
    entityId: saved.id,
    metadata: { count: assignments.length, name: proposalName },
  })

  return NextResponse.json({ id: saved.id })
}
