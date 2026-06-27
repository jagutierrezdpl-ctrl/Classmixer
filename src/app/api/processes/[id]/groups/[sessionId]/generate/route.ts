import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, hasFullAccess, tutorCanAccessProcess } from "@/lib/auth"
import { NextResponse } from "next/server"
import { generateBestGroups } from "@/lib/algorithm/groups"
import type { Student } from "@/types"

export async function POST(_req: Request, { params }: { params: Promise<{ id: string; sessionId: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const { id, sessionId } = await params
  const supabase = createServiceClient()

  const { data: proc } = await supabase.from("processes").select("center_id").eq("id", id).single()
  if (!proc || proc.center_id !== profile.center_id) return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  if (!hasFullAccess(profile.role) && !(await tutorCanAccessProcess(profile.center_id, profile.id, id))) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: session } = await (supabase as any)
    .from("group_sessions")
    .select("*, sociogram_snapshots(name)")
    .eq("id", sessionId)
    .eq("process_id", id)
    .single()
  if (!session) return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 })

  const { data: students } = await supabase
    .from("students")
    .select("*")
    .eq("process_id", id)
    .eq("active", true)
    .eq("current_class", session.class_name)

  if (!students || students.length === 0) {
    return NextResponse.json({ error: "No hay alumnos en esta clase" }, { status: 400 })
  }

  const studentIds = new Set((students as Student[]).map(s => s.id))

  // Load social data when use_sociogram is enabled
  let socialConnections: Map<string, Set<string>> | undefined
  let socialConflicts: Map<string, Set<string>> | undefined

  if (session.use_sociogram) {
    // Prefer snapshot data if set; otherwise fall back to current responses
    let rawConnections: Array<{ from: string; to: string; type: string }> = []

    if (session.sociogram_snapshot_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: snap } = await (supabase as any)
        .from("sociogram_snapshots")
        .select("connections")
        .eq("id", session.sociogram_snapshot_id)
        .single()
      if (snap?.connections) {
        rawConnections = snap.connections as typeof rawConnections
      }
    } else {
      const { data: responses } = await supabase
        .from("responses")
        .select("respondent_student_id, target_student_id, relation_type")
        .eq("process_id", id)
      rawConnections = (responses ?? []).map(r => ({
        from: r.respondent_student_id,
        to: r.target_student_id,
        type: r.relation_type,
      }))
    }

    socialConnections = new Map()
    socialConflicts = new Map()
    for (const c of rawConnections) {
      if (!studentIds.has(c.from) || !studentIds.has(c.to)) continue
      if (c.type === "negative") {
        if (!socialConflicts.has(c.from)) socialConflicts.set(c.from, new Set())
        socialConflicts.get(c.from)!.add(c.to)
      } else if (c.type === "friendship" || c.type === "work") {
        if (!socialConnections.has(c.from)) socialConnections.set(c.from, new Set())
        socialConnections.get(c.from)!.add(c.to)
      }
    }
  }

  // Build anti-repetition map from all previous group sets in this session
  const previousGroupings = new Map<string, Set<string>>()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: prevSets } = await (supabase as any)
    .from("group_sets")
    .select("id, group_assignments(student_id, group_number)")
    .eq("session_id", sessionId)

  if (prevSets) {
    for (const gs of prevSets) {
      const byGroup = new Map<number, string[]>()
      for (const a of (gs.group_assignments ?? [])) {
        if (!byGroup.has(a.group_number)) byGroup.set(a.group_number, [])
        byGroup.get(a.group_number)!.push(a.student_id)
      }
      for (const [, members] of byGroup) {
        for (let i = 0; i < members.length; i++) {
          for (let j = i + 1; j < members.length; j++) {
            const a = members[i], b = members[j]
            if (!previousGroupings.has(a)) previousGroupings.set(a, new Set())
            if (!previousGroupings.has(b)) previousGroupings.set(b, new Set())
            previousGroupings.get(a)!.add(b)
            previousGroupings.get(b)!.add(a)
          }
        }
      }
    }
  }

  // Load cooperative rules (must_separate / must_keep_together)
  const mustSeparate: Array<[string, string]> = []
  const mustKeepTogether: Array<[string, string]> = []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rules } = await (supabase as any)
    .from("cooperative_rules")
    .select("id, rule_type, cooperative_rule_students(student_id)")
    .eq("session_id", sessionId)
    .eq("active", true)

  if (rules) {
    for (const rule of rules) {
      const ids: string[] = (rule.cooperative_rule_students ?? []).map((rs: { student_id: string }) => rs.student_id)
      // Only include students actually in this class
      const validIds = ids.filter((sid: string) => studentIds.has(sid))
      if (validIds.length < 2) continue
      // Expand into all pairs
      for (let i = 0; i < validIds.length; i++) {
        for (let j = i + 1; j < validIds.length; j++) {
          if (rule.rule_type === "must_separate") {
            mustSeparate.push([validIds[i], validIds[j]])
          } else if (rule.rule_type === "must_keep_together") {
            mustKeepTogether.push([validIds[i], validIds[j]])
          }
        }
      }
    }
  }

  const groupSizes: number[] | undefined =
    Array.isArray(session.group_sizes) && session.group_sizes.length > 0
      ? (session.group_sizes as number[])
      : undefined

  const result = generateBestGroups(students as Student[], {
    numGroups: groupSizes ? groupSizes.length : session.num_groups,
    maxPerGroup: groupSizes ? undefined : (session.max_per_group ?? undefined),
    groupSizes,
    balanceGender: session.balance_gender,
    balanceAcademic: session.balance_academic,
    useSociogram: session.use_sociogram,
    socialConnections: socialConnections && socialConnections.size > 0 ? socialConnections : undefined,
    socialConflicts: socialConflicts && socialConflicts.size > 0 ? socialConflicts : undefined,
    previousGroupings: previousGroupings.size > 0 ? previousGroupings : undefined,
    mustSeparate: mustSeparate.length > 0 ? mustSeparate : undefined,
    mustKeepTogether: mustKeepTogether.length > 0 ? mustKeepTogether : undefined,
  }, 20)

  // Build rationale report
  const studentMap = new Map((students as Student[]).map(s => [s.id, s]))
  const byGroup = new Map<number, string[]>()
  for (const a of result.assignments) {
    if (!byGroup.has(a.group_number)) byGroup.set(a.group_number, [])
    byGroup.get(a.group_number)!.push(a.student_id)
  }

  const groupReports = [...byGroup.entries()].sort(([a], [b]) => a - b).map(([num, memberIds]) => {
    const members = memberIds.map(sid => studentMap.get(sid)).filter(Boolean) as Student[]
    const genderCount: Record<string, number> = {}
    const levelCount: Record<string, number> = {}
    let gradeSum = 0, gradeCount = 0
    let socialPairs = 0, conflictPairs = 0, repeatedPairs = 0

    for (const m of members) {
      genderCount[m.gender ?? "?"] = (genderCount[m.gender ?? "?"] ?? 0) + 1
      const lvl = m.academic_level ?? "?"
      levelCount[lvl] = (levelCount[lvl] ?? 0) + 1
      if (m.average_grade != null) { gradeSum += m.average_grade; gradeCount++ }
    }

    for (let i = 0; i < memberIds.length; i++) {
      for (let j = i + 1; j < memberIds.length; j++) {
        const a = memberIds[i], b = memberIds[j]
        if (socialConnections?.get(a)?.has(b) || socialConnections?.get(b)?.has(a)) socialPairs++
        if (socialConflicts?.get(a)?.has(b) || socialConflicts?.get(b)?.has(a)) conflictPairs++
        if (previousGroupings.get(a)?.has(b) || previousGroupings.get(b)?.has(a)) repeatedPairs++
      }
    }

    return {
      number: num,
      size: members.length,
      gender: genderCount,
      avg_grade: gradeCount > 0 ? Math.round((gradeSum / gradeCount) * 10) / 10 : null,
      levels: levelCount,
      social_pairs: socialPairs,
      conflict_pairs: conflictPairs,
      repeated_pairs: repeatedPairs,
    }
  })

  const ruleReports = (rules ?? []).map((rule: { rule_type: string; cooperative_rule_students: { student_id: string }[] }) => {
    const ids = (rule.cooperative_rule_students ?? []).map((rs: { student_id: string }) => rs.student_id).filter((sid: string) => studentIds.has(sid))
    const names = ids.map((sid: string) => {
      const s = studentMap.get(sid)
      return s ? `${s.first_name} ${s.last_name}` : sid
    })
    // Check if satisfied: for must_separate, no pair should share a group
    let satisfied = true
    if (rule.rule_type === "must_separate") {
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const ga = result.assignments.find(a => a.student_id === ids[i])?.group_number
          const gb = result.assignments.find(a => a.student_id === ids[j])?.group_number
          if (ga != null && gb != null && ga === gb) { satisfied = false; break }
        }
        if (!satisfied) break
      }
    } else if (rule.rule_type === "must_keep_together") {
      const groups = ids.map((sid: string) => result.assignments.find(a => a.student_id === sid)?.group_number)
      satisfied = groups.every(g => g != null && g === groups[0])
    }
    return { type: rule.rule_type, students: names, satisfied }
  })

  const totalSocialPairs = groupReports.reduce((s, g) => s + g.social_pairs, 0)
  const totalConflictPairs = groupReports.reduce((s, g) => s + g.conflict_pairs, 0)
  const totalRepeated = groupReports.reduce((s, g) => s + g.repeated_pairs, 0)

  const rationale = {
    score: result.score_total,
    settings: {
      balance_gender: session.balance_gender,
      balance_academic: session.balance_academic,
      use_sociogram: session.use_sociogram,
      snapshot_name: session.sociogram_snapshots?.name ?? null,
      group_sizes: groupSizes ?? null,
    },
    rules: ruleReports,
    groups: groupReports,
    totals: {
      students: (students as Student[]).length,
      rules_satisfied: ruleReports.filter((r: { satisfied: boolean }) => r.satisfied).length,
      rules_violated: ruleReports.filter((r: { satisfied: boolean }) => !r.satisfied).length,
      social_pairs_within: totalSocialPairs,
      conflict_pairs_within: totalConflictPairs,
      repeated_pairs: totalRepeated,
    },
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count } = await (supabase as any)
    .from("group_sets")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId)

  const setName = `Grupos ${(count ?? 0) + 1}`

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: groupSet, error: setErr } = await (supabase as any)
    .from("group_sets")
    .insert({ session_id: sessionId, name: setName, score_total: result.score_total, status: "generado", rationale })
    .select()
    .single()

  if (setErr || !groupSet) return NextResponse.json({ error: setErr?.message ?? "Error al guardar" }, { status: 500 })

  if (result.assignments.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("group_assignments").insert(
      result.assignments.map(a => ({ ...a, group_set_id: groupSet.id }))
    )
  }

  return NextResponse.json({ id: groupSet.id, score_total: result.score_total })
}
