import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, hasFullAccess, tutorCanAccessProcess, logAudit } from "@/lib/auth"
import { NextResponse } from "next/server"
import { generateProposals, checkInfeasibility, DEFAULT_CONSTRAINTS } from "@/lib/algorithm/heuristic"
import type { AlgorithmConstraints } from "@/lib/algorithm/heuristic"
import { DEFAULT_WEIGHTS } from "@/lib/algorithm/weights"
import { getQuestionCatalogIndex } from "@/lib/questionnaire/catalog"
import type { ScoringRoleMap } from "@/lib/questionnaire/catalog"
import type { AlgorithmWeights } from "@/types"

type ClassProposal = {
  assignments: { student_id: string; target_class: string }[]
  score_total: number
  score_social: number
  score_academic: number
  score_gender: number
  score_behavior: number
  metrics: Record<string, Record<string, number>>
}

async function callPythonSolver(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  students: any[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  responses: any[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rules: any[],
  targetClasses: string[],
  numProposals: number,
  weights: AlgorithmWeights,
  constraints: AlgorithmConstraints,
  minPerClass: number,
  maxPerClass: number,
  scoringRoles: ScoringRoleMap,
): Promise<ClassProposal[] | null> {
  const serviceUrl = process.env.PYTHON_SERVICE_URL
  if (!serviceUrl) return null

  try {
    const body = {
      students: students.map(s => ({
        id: s.id,
        gender: s.gender ?? null,
        average_grade: s.average_grade ?? 0,
        academic_level: s.academic_level ?? null,
        behavior_level: s.behavior_level ?? null,
        needs_type: s.needs_type ?? null,
        current_class: s.current_class ?? null,
      })),
      responses: responses.map(r => ({
        respondent_student_id: r.respondent_student_id,
        target_student_id: r.target_student_id,
        relation_type: r.relation_type,
        weight: r.weight ?? 1.0,
      })),
      rules: rules.map(r => ({
        id: r.id,
        rule_type: r.rule_type,
        priority: r.priority ?? "alta",
        active: r.active !== false,
        student_ids: (r.students ?? []).map((s: { student_id: string }) => s.student_id),
        target_class: r.target_class ?? null,
        max_count: r.max_count ?? null,
      })),
      target_classes: targetClasses,
      min_per_class: minPerClass,
      max_per_class: maxPerClass,
      weights: {
        conflicts: weights.conflicts,
        avoid_isolation: weights.avoid_isolation,
        reciprocal_friendships: weights.reciprocal_friendships,
        chosen_friendships: weights.chosen_friendships,
        work_relations: weights.work_relations,
        academic_balance: weights.academic_balance,
        gender_balance: weights.gender_balance,
        group_mix: weights.group_mix,
        behavior: weights.behavior,
        needs_distribution: weights.special_needs,
      },
      constraints: {
        enforce_origin_mix: constraints.enforce_origin_mix,
        max_origin_pct: constraints.max_origin_pct,
        enforce_gender_balance: constraints.enforce_gender_balance,
        gender_tolerance: constraints.gender_tolerance,
        enforce_equal_size: constraints.enforce_equal_size,
      },
      num_proposals: numProposals,
      time_limit_seconds: 30,
      seed: 42,
      friendship_types: scoringRoles.friendshipLike,
      work_types: scoringRoles.workLike,
      negative_types: scoringRoles.negativeLike,
    }

    const res = await fetch(`${serviceUrl}/solve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    })

    if (!res.ok) return null

    const data = await res.json()
    if (!data.feasible || !data.proposals?.length) return null

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return data.proposals.map((p: any) => ({
      assignments: p.assignments,
      score_total: p.score_total,
      score_social: p.score_social,
      score_academic: p.score_academic,
      score_gender: p.score_gender,
      score_behavior: p.score_behavior,
      metrics: Object.fromEntries(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Object.entries(p.metrics ?? {}).map(([cls, m]: [string, any]) => [
          cls,
          {
            count: m.count,
            average_grade: m.average_grade,
            female: m.female,
            male: m.male,
            students_with_friend: m.students_with_friend,
            reciprocal_preserved: m.reciprocal_preserved,
            with_needs: m.with_needs,
            with_behavior_issues: m.with_behavior_issues,
          },
        ])
      ),
    }))
  } catch {
    return null
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params
  const supabase = createServiceClient()

  const { data: ownerCheck } = await supabase
    .from("processes")
    .select("center_id")
    .eq("id", id)
    .single()

  if (!ownerCheck || ownerCheck.center_id !== profile.center_id) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  }
  if (!hasFullAccess(profile.role) && !(await tutorCanAccessProcess(profile.center_id, profile.id, id))) {
    return NextResponse.json({ error: "Sin acceso a este proceso" }, { status: 403 })
  }

  let weights: AlgorithmWeights = DEFAULT_WEIGHTS
  let constraints: AlgorithmConstraints = DEFAULT_CONSTRAINTS
  let numProposals = 3
  let useSociogram = true

  try {
    const body = await request.json()
    if (body.weights) weights = { ...DEFAULT_WEIGHTS, ...body.weights }
    if (body.constraints) constraints = { ...DEFAULT_CONSTRAINTS, ...body.constraints }
    if (body.num_proposals) numProposals = Math.min(10, Math.max(1, Number(body.num_proposals)))
    if (body.use_sociogram === false) useSociogram = false
  } catch {
    // No body — use defaults
  }

  const [
    { data: process },
    { data: students },
    { data: responses },
    { data: rules },
  ] = await Promise.all([
    supabase.from("processes").select("*").eq("id", id).single(),
    supabase.from("students").select("*").eq("process_id", id).eq("active", true),
    supabase.from("responses").select("*").eq("process_id", id),
    supabase.from("rules").select("*, rule_students(student_id)").eq("process_id", id).eq("active", true),
  ])

  if (!process || !students) {
    return NextResponse.json({ error: "Proceso o alumnos no encontrados" }, { status: 404 })
  }

  const targetClasses = process.target_groups as string[]
  if (!targetClasses || targetClasses.length === 0) {
    return NextResponse.json({ error: "No hay grupos destino configurados" }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rulesWithStudents = ((rules ?? []) as any[]).map((r: any) => ({
    ...r,
    students: r.rule_students?.map((rs: { student_id: string }) => ({ student_id: rs.student_id })) ?? [],
  }))

  // Check feasibility before running
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const infeasibility = checkInfeasibility(students as any, rulesWithStudents as any, targetClasses)
  if (!infeasibility.feasible) {
    return NextResponse.json(
      { error: "Hay reglas incompatibles", infeasibility },
      { status: 422 }
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const minPerClass = (process as any).min_class_size ?? 20
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const maxPerClass = (process as any).max_class_size ?? 35

  // Filter out excluded students before sending to any solver
  const excludedIds = new Set(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (rulesWithStudents as any[])
      .filter(r => r.rule_type === "exclude_student" && r.active !== false)
      .flatMap((r: { students: { student_id: string }[] }) => r.students.map(s => s.student_id))
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const assignableStudents = (students as any[]).filter(s => !excludedIds.has(s.id))

  const catalogIndex = await getQuestionCatalogIndex(profile.center_id)

  const responsesForAlgorithm = useSociogram ? (responses ?? []) : []

  // Try Python OR-Tools solver first; fall back to heuristic
  let proposals: ClassProposal[] | null = await callPythonSolver(
    assignableStudents,
    responsesForAlgorithm,
    rulesWithStudents,
    targetClasses,
    numProposals,
    weights,
    constraints,
    minPerClass,
    maxPerClass,
    catalogIndex.scoringRoles,
  )

  const usedSolver = proposals !== null ? "ortools" : "heuristic"

  if (!proposals) {
    proposals = generateProposals(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      assignableStudents as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      responsesForAlgorithm as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rulesWithStudents as any,
      targetClasses,
      numProposals,
      weights,
      constraints,
      {
        friendshipLike: catalogIndex.scoringRoles.friendshipLike,
        workLike: catalogIndex.scoringRoles.workLike,
        negativeLike: catalogIndex.scoringRoles.negativeLike,
      }
    ) as ClassProposal[]
  }

  if (proposals.length === 0) {
    return NextResponse.json({ error: "No se pudieron generar propuestas" }, { status: 422 })
  }

  // Delete old non-approved proposals
  const { data: oldProposals } = await supabase
    .from("proposals")
    .select("id")
    .eq("process_id", id)
    .neq("status", "aprobada")

  if (oldProposals && oldProposals.length > 0) {
    await supabase.from("proposals").delete().in("id", oldProposals.map(p => p.id))
  }

  const savedIds: string[] = []
  const labels = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"]

  for (let i = 0; i < proposals.length; i++) {
    const p = proposals[i]
    const { data: saved, error } = await supabase
      .from("proposals")
      .insert({
        process_id: id,
        name: `Propuesta ${labels[i] ?? i + 1}`,
        score_total: p.score_total,
        score_social: p.score_social,
        score_academic: p.score_academic,
        score_gender: p.score_gender,
        score_behavior: p.score_behavior,
        status: "generada",
        created_by: profile.id,
      })
      .select()
      .single()

    if (error || !saved) continue

    await supabase.from("proposal_assignments").insert(
      p.assignments.map(a => ({
        proposal_id: saved.id,
        student_id: a.student_id,
        target_class: a.target_class,
        locked: false,
      }))
    )

    const metricRows: { proposal_id: string; metric_key: string; metric_value: number; target_class: string | null }[] = [
      { proposal_id: saved.id, metric_key: "use_sociogram", metric_value: useSociogram ? 1 : 0, target_class: null },
    ]
    for (const [cls, metrics] of Object.entries(p.metrics)) {
      for (const [key, value] of Object.entries(metrics)) {
        metricRows.push({ proposal_id: saved.id, metric_key: key, metric_value: value, target_class: cls })
      }
    }
    if (metricRows.length > 0) {
      await supabase.from("proposal_metrics").insert(metricRows)
    }

    savedIds.push(saved.id)
  }

  await supabase
    .from("processes")
    .update({ status: "propuestas_generadas", updated_at: new Date().toISOString() })
    .eq("id", id)

  await logAudit(profile.id, profile.center_id, "generate_proposals", "proposal", {
    processId: id,
    metadata: { count: savedIds.length, profile: "custom", numRequested: numProposals, solver: usedSolver },
  })

  return NextResponse.json({ generated: savedIds.length, ids: savedIds })
}
