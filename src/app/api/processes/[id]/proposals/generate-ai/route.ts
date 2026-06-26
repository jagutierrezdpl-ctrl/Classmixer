import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, hasFullAccess, tutorCanAccessProcess, logAudit } from "@/lib/auth"
import { NextResponse } from "next/server"
import { generateAIMixProposals } from "@/lib/ai"
import { scoreAssignments, DEFAULT_RELATION_TYPES } from "@/lib/algorithm/heuristic"
import { DEFAULT_WEIGHTS } from "@/lib/algorithm/weights"
import { getQuestionCatalogIndex } from "@/lib/questionnaire/catalog"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params
  const supabase = createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: process } = await (supabase as any).from("processes").select("*").eq("id", id).single()
  if (!process || process.center_id !== profile.center_id) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  }
  if (!hasFullAccess(profile.role) && !(await tutorCanAccessProcess(profile.center_id, profile.id, id))) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 })
  }

  let instructions = ""
  let numProposals = 1
  try {
    const body = await request.json()
    if (body.instructions) instructions = String(body.instructions).slice(0, 1200)
    if (body.num_proposals) numProposals = Math.min(3, Math.max(1, Number(body.num_proposals)))
  } catch { /* no body — use defaults */ }

  const targetClasses = process.target_groups as string[]
  if (!targetClasses?.length) {
    return NextResponse.json({ error: "No hay grupos destino configurados" }, { status: 400 })
  }

  const [
    { data: students },
    { data: responses },
    { data: rules },
    { data: centerSettings },
  ] = await Promise.all([
    supabase.from("students").select("*").eq("process_id", id).eq("active", true),
    supabase.from("responses").select("*").eq("process_id", id),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from("rules").select("*, rule_students(student_id, students(first_name, last_name))").eq("process_id", id).eq("active", true),
    supabase.from("centers").select("openrouter_api_key, openrouter_model").eq("id", profile.center_id).single(),
  ])

  if (!students?.length) return NextResponse.json({ error: "Sin alumnos en este proceso" }, { status: 400 })

  const catalogIndex = await getQuestionCatalogIndex(profile.center_id)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const excludedIds = new Set<string>((rules ?? []).filter((r: any) => r.rule_type === "exclude_student").flatMap((r: any) => (r.rule_students ?? []).map((rs: any) => rs.student_id)))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activeStudents = (students as any[]).filter(s => !excludedIds.has(s.id) && !(s as any).excluded_from_mix)

  const studentNameMap = new Map<string, string>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    activeStudents.map((s: any) => [s.id as string, `${s.first_name} ${s.last_name}`])
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const studentInfos = activeStudents.map((s: any) => ({
    id: s.id as string,
    name: `${s.first_name} ${s.last_name}`,
    current_class: s.current_class ?? "—",
    gender: s.gender ?? "—",
    average_grade: s.average_grade ?? 0,
    behavior_level: s.behavior_level ?? undefined,
    needs_type: s.needs_type ?? undefined,
  }))

  const visibleRelations = new Set([
    ...catalogIndex.scoringRoles.friendshipLike,
    ...catalogIndex.scoringRoles.workLike,
    "emotional",
  ])
  const choiceInfos = (responses ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((r: any) =>
      visibleRelations.has(r.relation_type) &&
      studentNameMap.has(r.respondent_student_id) &&
      studentNameMap.has(r.target_student_id)
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((r: any) => ({
      from_name: studentNameMap.get(r.respondent_student_id)!,
      to_name: studentNameMap.get(r.target_student_id)!,
      relation_type: r.relation_type as string,
    }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ruleInfos = (rules ?? []).filter((r: any) => r.rule_type !== "exclude_student").map((r: any) => ({
    rule_type: r.rule_type as string,
    description: r.description ?? undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    student_names: (r.rule_students ?? []).map((rs: any) => rs.students ? `${rs.students.first_name} ${rs.students.last_name}` : rs.student_id),
    target_class: r.target_class ?? undefined,
    max_count: r.max_count ?? undefined,
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rulesWithStudents = (rules ?? []).map((r: any) => ({
    ...r,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    students: (r.rule_students ?? []).map((rs: any) => ({ student_id: rs.student_id })),
  }))

  try {
    const aiProposals = await generateAIMixProposals(
      studentInfos,
      choiceInfos,
      ruleInfos,
      targetClasses,
      numProposals,
      instructions || undefined,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (centerSettings as any)?.openrouter_api_key ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (centerSettings as any)?.openrouter_model ?? null
    )

    if (!aiProposals.length) {
      return NextResponse.json({ error: "La IA no pudo generar propuestas" }, { status: 422 })
    }

    const activeStudentIds = new Set(activeStudents.map(s => s.id as string))

    const validProposals = aiProposals
      .filter(p => {
        const assignedIds = new Set(Object.keys(p.assignments))
        return (
          [...activeStudentIds].every(sid => assignedIds.has(sid)) &&
          Object.values(p.assignments).every(cls => targetClasses.includes(cls))
        )
      })
      .map(p => {
        const assignments = Object.entries(p.assignments).map(([student_id, target_class]) => ({
          student_id,
          target_class,
        }))
        const scored = scoreAssignments(
          assignments,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          activeStudents as any,
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
          } as typeof DEFAULT_RELATION_TYPES
        )
        return { assignments, rationale: p.rationale, name: p.name, ...scored }
      })

    if (!validProposals.length) {
      return NextResponse.json({
        error: "La IA generó propuestas con alumnos faltantes o clases incorrectas. Inténtalo de nuevo.",
      }, { status: 422 })
    }

    const { data: savedProposals } = await supabase
      .from("proposals")
      .insert(
        validProposals.map(p => ({
          process_id: id,
          name: p.name,
          score_total: p.score_total,
          score_social: p.score_social,
          score_academic: p.score_academic,
          score_gender: p.score_gender,
          score_behavior: p.score_behavior,
          status: "generada",
          created_by: profile.id,
        }))
      )
      .select("id")

    if (!savedProposals?.length) {
      return NextResponse.json({ error: "No se pudieron guardar las propuestas" }, { status: 500 })
    }

    const allAssignments = validProposals.flatMap((p, i) => {
      const proposalId = savedProposals[i]?.id
      if (!proposalId) return []
      return p.assignments.map(a => ({
        proposal_id: proposalId,
        student_id: a.student_id,
        target_class: a.target_class,
        locked: false,
      }))
    })
    if (allAssignments.length) await supabase.from("proposal_assignments").insert(allAssignments)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allMetrics: any[] = []
    validProposals.forEach((p, i) => {
      const proposalId = savedProposals[i]?.id
      if (!proposalId) return
      allMetrics.push({ proposal_id: proposalId, metric_key: "use_sociogram", metric_value: 1, target_class: null })
      allMetrics.push({ proposal_id: proposalId, metric_key: "ai_generated", metric_value: 1, target_class: null })
      for (const [cls, metrics] of Object.entries(p.metrics)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const [key, value] of Object.entries(metrics as any)) {
          allMetrics.push({ proposal_id: proposalId, metric_key: key, metric_value: value, target_class: cls })
        }
      }
    })
    if (allMetrics.length) await supabase.from("proposal_metrics").insert(allMetrics)

    // Save AI rationale to ai_reports
    for (let i = 0; i < validProposals.length; i++) {
      const proposalId = savedProposals[i]?.id
      if (!proposalId || !validProposals[i].rationale) continue
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("ai_reports").insert({
        process_id: id,
        report_type: "proposal_rationale",
        content: validProposals[i].rationale,
        created_by: profile.id,
        metadata: { proposal_id: proposalId, proposal_name: validProposals[i].name },
      })
    }

    await supabase
      .from("processes")
      .update({ status: "propuestas_generadas", updated_at: new Date().toISOString() })
      .eq("id", id)

    await logAudit(profile.id, profile.center_id, "generate_proposals", "proposal", {
      processId: id,
      metadata: { count: savedProposals.length, solver: "ai", numRequested: numProposals },
    })

    return NextResponse.json({ generated: savedProposals.length, ids: savedProposals.map(p => p.id) })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al generar con IA" },
      { status: 500 }
    )
  }
}
