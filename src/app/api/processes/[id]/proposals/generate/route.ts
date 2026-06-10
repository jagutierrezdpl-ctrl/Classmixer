import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, logAudit } from "@/lib/auth"
import { NextResponse } from "next/server"
import { generateProposals, checkInfeasibility, DEFAULT_CONSTRAINTS } from "@/lib/algorithm/heuristic"
import type { AlgorithmConstraints } from "@/lib/algorithm/heuristic"
import { DEFAULT_WEIGHTS } from "@/lib/algorithm/weights"
import type { AlgorithmWeights } from "@/types"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params
  const supabase = createServiceClient()

  let weights: AlgorithmWeights = DEFAULT_WEIGHTS
  let constraints: AlgorithmConstraints = DEFAULT_CONSTRAINTS
  let numProposals = 3

  try {
    const body = await request.json()
    if (body.weights) weights = { ...DEFAULT_WEIGHTS, ...body.weights }
    if (body.constraints) constraints = { ...DEFAULT_CONSTRAINTS, ...body.constraints }
    if (body.num_proposals) numProposals = Math.min(10, Math.max(1, Number(body.num_proposals)))
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

  const proposals = generateProposals(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    students as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (responses ?? []) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rulesWithStudents as any,
    targetClasses,
    numProposals,
    weights,
    constraints
  )

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

    const metricRows: { proposal_id: string; metric_key: string; metric_value: number; target_class: string }[] = []
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
    metadata: { count: savedIds.length, profile: "custom", numRequested: numProposals },
  })

  return NextResponse.json({ generated: savedIds.length, ids: savedIds })
}
