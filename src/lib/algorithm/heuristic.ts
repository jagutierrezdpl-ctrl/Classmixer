import type { Student, Response, Rule, AlgorithmWeights } from "@/types"
import { DEFAULT_WEIGHTS } from "./weights"
import { simulateFutureSociogram } from "./simulation"

export interface RelationTypeGroups {
  friendshipLike: string[]
  workLike: string[]
  negativeLike: string[]
}

export const DEFAULT_RELATION_TYPES: RelationTypeGroups = {
  friendshipLike: ["friendship"],
  workLike: ["work"],
  negativeLike: ["negative"],
}

export interface AssignmentResult {
  student_id: string
  target_class: string
}

export interface ProposalResult {
  assignments: AssignmentResult[]
  score_total: number
  score_social: number
  score_academic: number
  score_gender: number
  score_behavior: number
  metrics: Record<string, Record<string, number>>
  infeasible_rules?: string[]
}

export interface InfeasibilityReport {
  feasible: boolean
  blocking_rules: string[]
  explanation: string[]
}

function shuffle<T>(arr: T[], seed: number): T[] {
  const result = [...arr]
  let s = seed
  for (let i = result.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    const j = Math.abs(s) % (i + 1)
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

type SubScores = {
  avoid_isolation: number
  reciprocal_friendships: number
  chosen_friendships: number
  work_relations: number
  academic_balance: number
  gender_balance: number
  group_mix: number
  behavior: number
  special_needs: number
  conflicts: number
}

function computeSubScores(
  assignments: AssignmentResult[],
  students: Student[],
  responses: Response[],
  rules: Rule[],
  targetClasses: string[],
  relationTypes: RelationTypeGroups = DEFAULT_RELATION_TYPES
): SubScores {
  const studentMap = new Map(students.map(s => [s.id, s]))
  const assignMap = new Map(assignments.map(a => [a.student_id, a.target_class]))

  const friendships = responses.filter(r => relationTypes.friendshipLike.includes(r.relation_type))
  const workRelations = responses.filter(r => relationTypes.workLike.includes(r.relation_type))

  const reciprocalPairs = new Set<string>()
  friendships.forEach(r => {
    const hasReverse = friendships.some(
      f =>
        f.respondent_student_id === r.target_student_id &&
        f.target_student_id === r.respondent_student_id
    )
    if (hasReverse) {
      const key = [r.respondent_student_id, r.target_student_id].sort().join("_")
      reciprocalPairs.add(key)
    }
  })

  // avoid_isolation: % of students with at least one friendship bond (either direction) in same class
  let studentsWithFriend = 0
  students.forEach(s => {
    const myClass = assignMap.get(s.id)
    const hasFriend = friendships.some(r =>
      (r.respondent_student_id === s.id && assignMap.get(r.target_student_id) === myClass) ||
      (r.target_student_id === s.id && assignMap.get(r.respondent_student_id) === myClass)
    )
    if (hasFriend) studentsWithFriend++
  })
  const avoidIsolation = students.length > 0 ? (studentsWithFriend / students.length) * 100 : 100

  // reciprocal_friendships: % of reciprocal pairs kept together
  let reciprocalPreserved = 0
  reciprocalPairs.forEach(pair => {
    const [a, b] = pair.split("_")
    if (assignMap.get(a) === assignMap.get(b)) reciprocalPreserved++
  })
  const reciprocalScore =
    reciprocalPairs.size > 0 ? (reciprocalPreserved / reciprocalPairs.size) * 100 : 100

  // chosen_friendships: % of all chosen friendships in same class
  const friendshipsPreserved = friendships.filter(
    r => assignMap.get(r.respondent_student_id) === assignMap.get(r.target_student_id)
  ).length
  const chosenFriendScore =
    friendships.length > 0 ? (friendshipsPreserved / friendships.length) * 100 : 100

  // work_relations: % of work relations in same class
  const workPreserved = workRelations.filter(
    r => assignMap.get(r.respondent_student_id) === assignMap.get(r.target_student_id)
  ).length
  const workScore = workRelations.length > 0 ? (workPreserved / workRelations.length) * 100 : 100

  // academic_balance: inverse variance of mean grades per class
  const classGrades = new Map<string, number[]>()
  targetClasses.forEach(c => classGrades.set(c, []))
  assignments.forEach(a => {
    const s = studentMap.get(a.student_id)
    if (s) classGrades.get(a.target_class)?.push(s.average_grade)
  })
  const classMeans = targetClasses
    .map(c => {
      const g = classGrades.get(c) ?? []
      return g.length > 0 ? g.reduce((x, y) => x + y, 0) / g.length : 0
    })
    .filter(m => m > 0)
  const overallMean =
    classMeans.length > 0 ? classMeans.reduce((x, y) => x + y, 0) / classMeans.length : 0
  const gradeVariance =
    classMeans.length > 0
      ? classMeans.reduce((sum, m) => sum + Math.pow(m - overallMean, 2), 0) / classMeans.length
      : 0
  const academicScore = Math.max(0, 100 - gradeVariance * 20)

  // gender_balance: inverse variance of F/total ratio per class vs actual global ratio
  const totalFGlobal = students.filter(s => s.gender === "F").length
  const totalBinaryGlobal = students.filter(s => s.gender === "F" || s.gender === "M").length
  const globalFRatioForScore = totalBinaryGlobal > 0 ? totalFGlobal / totalBinaryGlobal : 0.5
  const classGenders = new Map<string, { F: number; M: number }>()
  targetClasses.forEach(c => classGenders.set(c, { F: 0, M: 0 }))
  assignments.forEach(a => {
    const s = studentMap.get(a.student_id)
    const g = classGenders.get(a.target_class)
    if (!g) return
    if (s?.gender === "F") g.F++
    else if (s?.gender === "M") g.M++
  })
  const genderRatios = targetClasses.map(c => {
    const g = classGenders.get(c)!
    const total = g.F + g.M
    return total > 0 ? g.F / total : globalFRatioForScore
  })
  const genderVariance =
    genderRatios.reduce((sum, r) => sum + Math.pow(r - globalFRatioForScore, 2), 0) / (genderRatios.length || 1)
  const genderScore = Math.max(0, 100 - genderVariance * 400)

  // group_mix: origin class spread across target classes
  const allOrigins = [...new Set(students.map(s => s.current_class))]
  let groupMixScore = 100
  if (allOrigins.length > 1) {
    const classByOrigin = new Map<string, Map<string, number>>()
    targetClasses.forEach(c => classByOrigin.set(c, new Map()))
    assignments.forEach(a => {
      const s = studentMap.get(a.student_id)
      if (s) {
        const m = classByOrigin.get(a.target_class)!
        m.set(s.current_class, (m.get(s.current_class) ?? 0) + 1)
      }
    })
    const vars: number[] = allOrigins.map(origin => {
      const counts = targetClasses.map(c => classByOrigin.get(c)?.get(origin) ?? 0)
      const mean = counts.reduce((x, y) => x + y, 0) / counts.length
      return counts.reduce((sum, c) => sum + Math.pow(c - mean, 2), 0) / counts.length
    })
    const avgVar = vars.reduce((x, y) => x + y, 0) / vars.length
    groupMixScore = Math.max(0, 100 - avgVar * 3)
  }

  // behavior: even distribution of Seguimiento/Conflictiva
  const conflictCounts = targetClasses.map(c => {
    return assignments.filter(a => {
      const s = studentMap.get(a.student_id)
      return (
        a.target_class === c &&
        (s?.behavior_level === "Seguimiento" || s?.behavior_level === "Conflictiva")
      )
    }).length
  })
  const conflictMean =
    conflictCounts.reduce((x, y) => x + y, 0) / (conflictCounts.length || 1)
  const conflictVariance =
    conflictCounts.reduce((sum, c) => sum + Math.pow(c - conflictMean, 2), 0) /
    (conflictCounts.length || 1)
  const behaviorScore = Math.max(0, 100 - conflictVariance * 10)

  // special_needs: even distribution
  const needsCounts = targetClasses.map(c =>
    assignments.filter(a => {
      const s = studentMap.get(a.student_id)
      return a.target_class === c && s?.needs_type && s.needs_type !== "No"
    }).length
  )
  const needsMean = needsCounts.reduce((x, y) => x + y, 0) / (needsCounts.length || 1)
  const needsVariance =
    needsCounts.reduce((sum, c) => sum + Math.pow(c - needsMean, 2), 0) /
    (needsCounts.length || 1)
  const specialNeedsScore = Math.max(0, 100 - needsVariance * 10)

  // conflicts: must_separate violations (×4) + negative nominations in same class + avoid_tutor violations (×3)
  const separationRules = rules.filter(r => r.rule_type === "must_separate" && r.active)
  let violatedSeparations = 0
  separationRules.forEach(r => {
    const ids = (r.students ?? []).map(rs => rs.student_id)
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const ci = assignMap.get(ids[i])
        const cj = assignMap.get(ids[j])
        if (ci && cj && ci === cj) violatedSeparations++
      }
    }
  })

  const negativeNoms = responses.filter(r => relationTypes.negativeLike.includes(r.relation_type))
  let rejectionViolations = 0
  negativeNoms.forEach(r => {
    if (
      assignMap.get(r.respondent_student_id) !== undefined &&
      assignMap.get(r.respondent_student_id) === assignMap.get(r.target_student_id)
    ) {
      rejectionViolations++
    }
  })

  const avoidTutorRules = rules.filter(r => r.rule_type === "avoid_tutor" && r.active && r.target_class)
  let avoidTutorViolations = 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  avoidTutorRules.forEach((r: any) => {
    const forbidden = r.target_class as string
    ;(r.students ?? []).forEach((rs: { student_id: string }) => {
      if (assignMap.get(rs.student_id) === forbidden) avoidTutorViolations++
    })
  })
  const totalAvoidTutorStudents = avoidTutorRules.reduce(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (n: number, r: any) => n + (r.students ?? []).length, 0
  )

  const totalViolations = violatedSeparations * 4 + rejectionViolations + avoidTutorViolations * 3
  const totalDenom = separationRules.length * 4 + negativeNoms.length + totalAvoidTutorStudents * 3
  const conflictsScore = totalDenom > 0
    ? Math.max(0, 100 - (totalViolations / totalDenom) * 100)
    : 100

  return {
    avoid_isolation: avoidIsolation,
    reciprocal_friendships: reciprocalScore,
    chosen_friendships: chosenFriendScore,
    work_relations: workScore,
    academic_balance: academicScore,
    gender_balance: genderScore,
    group_mix: groupMixScore,
    behavior: behaviorScore,
    special_needs: specialNeedsScore,
    conflicts: conflictsScore,
  }
}

function weightedTotal(sub: SubScores, weights: AlgorithmWeights): number {
  const keys = Object.keys(weights) as (keyof AlgorithmWeights)[]
  const totalWeight = keys.reduce((sum, k) => sum + weights[k], 0)
  if (totalWeight === 0) return 50
  return keys.reduce((sum, k) => sum + weights[k] * sub[k as keyof SubScores], 0) / totalWeight
}

// Fast score used inside the local-search loop
function computeScore(
  assignments: AssignmentResult[],
  students: Student[],
  responses: Response[],
  rules: Rule[],
  targetClasses: string[],
  weights: AlgorithmWeights,
  relationTypes: RelationTypeGroups = DEFAULT_RELATION_TYPES
): number {
  const sub = computeSubScores(assignments, students, responses, rules, targetClasses, relationTypes)
  return weightedTotal(sub, weights)
}

export function scoreAssignments(
  assignments: AssignmentResult[],
  students: Student[],
  responses: Response[],
  rules: Rule[],
  targetClasses: string[],
  weights: AlgorithmWeights = DEFAULT_WEIGHTS,
  relationTypes: RelationTypeGroups = DEFAULT_RELATION_TYPES
): Omit<ProposalResult, "assignments"> {
  return buildResult(assignments, students, responses, rules, targetClasses, weights, undefined, relationTypes)
}

// Full result including all sub-scores and per-class metrics
function buildResult(
  assignments: AssignmentResult[],
  students: Student[],
  responses: Response[],
  rules: Rule[],
  targetClasses: string[],
  weights: AlgorithmWeights,
  infeasibleRules?: string[],
  relationTypes: RelationTypeGroups = DEFAULT_RELATION_TYPES
): Omit<ProposalResult, "assignments"> {
  const studentMap = new Map(students.map(s => [s.id, s]))
  const sub = computeSubScores(assignments, students, responses, rules, targetClasses, relationTypes)

  const total = weightedTotal(sub, weights)

  const socialW = weights.avoid_isolation + weights.reciprocal_friendships + weights.chosen_friendships + weights.work_relations
  const scoreSocial =
    socialW > 0
      ? (weights.avoid_isolation * sub.avoid_isolation +
          weights.reciprocal_friendships * sub.reciprocal_friendships +
          weights.chosen_friendships * sub.chosen_friendships +
          weights.work_relations * sub.work_relations) /
        socialW
      : 50

  const behaviorW = weights.behavior + weights.special_needs
  const scoreBehavior =
    behaviorW > 0
      ? (weights.behavior * sub.behavior + weights.special_needs * sub.special_needs) / behaviorW
      : 50

  // Per-class metrics using future sociogram simulation
  const futureMetrics = simulateFutureSociogram(assignments, responses, relationTypes.friendshipLike)
  const futureMap = new Map(futureMetrics.map(fm => [fm.target_class, fm]))

  const friendships = responses.filter(r => relationTypes.friendshipLike.includes(r.relation_type))
  const assignMap = new Map(assignments.map(a => [a.student_id, a.target_class]))

  const metrics: Record<string, Record<string, number>> = {}
  targetClasses.forEach(cls => {
    const classStudents = assignments
      .filter(a => a.target_class === cls)
      .map(a => studentMap.get(a.student_id))
      .filter(Boolean) as Student[]

    const fm = futureMap.get(cls)

    const classSet = new Set(assignments.filter(a => a.target_class === cls).map(a => a.student_id))

    const reciprocalPairs = new Set<string>()
    friendships.forEach(r => {
      const hasReverse = friendships.some(
        f =>
          f.respondent_student_id === r.target_student_id &&
          f.target_student_id === r.respondent_student_id
      )
      if (hasReverse) {
        const key = [r.respondent_student_id, r.target_student_id].sort().join("_")
        reciprocalPairs.add(key)
      }
    })
    let reciprocalInClass = 0
    reciprocalPairs.forEach(pair => {
      const [a, b] = pair.split("_")
      if (classSet.has(a) && classSet.has(b)) reciprocalInClass++
    })

    let studentsWithFriendInClass = 0
    classStudents.forEach(s => {
      const hasFriend = friendships.some(r =>
        (r.respondent_student_id === s.id && assignMap.get(r.target_student_id) === cls) ||
        (r.target_student_id === s.id && assignMap.get(r.respondent_student_id) === cls)
      )
      if (hasFriend) studentsWithFriendInClass++
    })

    metrics[cls] = {
      count: classStudents.length,
      female: classStudents.filter(s => s.gender === "F").length,
      male: classStudents.filter(s => s.gender === "M").length,
      average_grade:
        classStudents.length > 0
          ? Math.round(
              (classStudents.reduce((sum, s) => sum + s.average_grade, 0) / classStudents.length) *
                100
            ) / 100
          : 0,
      with_needs: classStudents.filter(s => s.needs_type && s.needs_type !== "No").length,
      with_behavior_issues: classStudents.filter(s =>
        ["Seguimiento", "Conflictiva"].includes(s.behavior_level ?? "")
      ).length,
      reciprocal_preserved: reciprocalInClass,
      students_with_friend: studentsWithFriendInClass,
      students_isolated: classStudents.length - studentsWithFriendInClass,
      friendship_preservation_pct: fm?.friendship_preservation_pct ?? 0,
    }
  })

  return {
    score_total: Math.round(total * 10) / 10,
    score_social: Math.round(scoreSocial * 10) / 10,
    score_academic: Math.round(sub.academic_balance * 10) / 10,
    score_gender: Math.round(sub.gender_balance * 10) / 10,
    score_behavior: Math.round(scoreBehavior * 10) / 10,
    metrics,
    ...(infeasibleRules && infeasibleRules.length > 0 ? { infeasible_rules: infeasibleRules } : {}),
  }
}

export function checkInfeasibility(
  students: Student[],
  rules: Rule[],
  targetClasses: string[]
): InfeasibilityReport {
  const lockedStudents = new Map<string, string>()
  rules
    .filter(r => r.rule_type === "lock_student_to_class" && r.active)
    .forEach(r => {
      if (r.target_class) {
        const cls = r.target_class
        ;(r.students ?? []).forEach(rs => lockedStudents.set(rs.student_id, cls))
      }
    })

  const blocking: string[] = []
  const explanation: string[] = []

  rules
    .filter(r => r.rule_type === "must_separate" && r.active)
    .forEach(r => {
      const ids = (r.students ?? []).map(rs => rs.student_id)
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const si = ids[i]
          const sj = ids[j]
          if (lockedStudents.has(si) && lockedStudents.has(sj) && lockedStudents.get(si) === lockedStudents.get(sj)) {
            const desc = r.description ?? `Regla de separación`
            blocking.push(desc)
            const sA = students.find(s => s.id === si)
            const sB = students.find(s => s.id === sj)
            explanation.push(
              `${desc}: ${sA ? sA.first_name + " " + sA.last_name : si} y ${sB ? sB.first_name + " " + sB.last_name : sj} están bloqueados en la misma clase (${lockedStudents.get(si)}).`
            )
          }
        }
      }
    })

  rules
    .filter(r => r.rule_type === "must_keep_together" && r.active)
    .forEach(r => {
      const ids = (r.students ?? []).map(rs => rs.student_id)
      const lockedClasses = ids.filter(sid => lockedStudents.has(sid)).map(sid => lockedStudents.get(sid)!)
      const unique = [...new Set(lockedClasses)]
      if (unique.length > 1) {
        const desc = r.description ?? `Regla de mantener juntos`
        blocking.push(desc)
        explanation.push(`${desc}: los alumnos están bloqueados en clases distintas (${unique.join(", ")}).`)
      }
    })

  // must_keep_together + must_separate conflict
  rules
    .filter(r => r.rule_type === "must_keep_together" && r.active)
    .forEach(keepRule => {
      const keepIds = (keepRule.students ?? []).map(rs => rs.student_id)
      rules
        .filter(r => r.rule_type === "must_separate" && r.active)
        .forEach(sepRule => {
          const sepIds = new Set((sepRule.students ?? []).map(rs => rs.student_id))
          for (let i = 0; i < keepIds.length; i++) {
            for (let j = i + 1; j < keepIds.length; j++) {
              if (sepIds.has(keepIds[i]) && sepIds.has(keepIds[j])) {
                const sA = students.find(s => s.id === keepIds[i])
                const sB = students.find(s => s.id === keepIds[j])
                const nameA = sA ? `${sA.first_name} ${sA.last_name}` : keepIds[i]
                const nameB = sB ? `${sB.first_name} ${sB.last_name}` : keepIds[j]
                const desc = `Conflicto: ${nameA} y ${nameB} tienen reglas de "mantener juntos" y "separar obligatoriamente" al mismo tiempo.`
                if (!blocking.includes(desc)) {
                  blocking.push(desc)
                  explanation.push(desc)
                }
              }
            }
          }
        })
    })

  if (targetClasses.length === 0) {
    blocking.push("Sin clases destino")
    explanation.push("No hay clases destino configuradas para este proceso.")
  }

  const excludedViaRules = new Set(
    rules
      .filter(r => r.rule_type === "exclude_student" && r.active)
      .flatMap(r => (r.students ?? []).map(rs => rs.student_id))
  )
  const activeStudents = students.filter(s =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    !excludedViaRules.has(s.id) && !(s as any).excluded_from_mix
  )

  if (targetClasses.length > 0 && activeStudents.length < targetClasses.length) {
    blocking.push("Pocos alumnos")
    explanation.push(
      `Solo hay ${activeStudents.length} alumnos activos para ${targetClasses.length} clases destino.`
    )
  }

  return {
    feasible: blocking.length === 0,
    blocking_rules: blocking,
    explanation,
  }
}

export interface AlgorithmConstraints {
  enforce_origin_mix: boolean
  max_origin_pct: number        // 0–100: max % of students from same origin class in one target class
  enforce_gender_balance: boolean
  gender_tolerance: number      // 0–50: max % deviation from global gender ratio per class
  enforce_equal_size: boolean   // all target classes must have equal number of students (diff ≤ 1)
  enforce_no_isolation: boolean // post-processing pass: move students until every one has ≥1 connection
}

export const DEFAULT_CONSTRAINTS: AlgorithmConstraints = {
  enforce_origin_mix: true,
  max_origin_pct: 50,
  enforce_gender_balance: false,
  gender_tolerance: 15,
  enforce_equal_size: false,
  enforce_no_isolation: true,
}

export function generateProposals(
  students: Student[],
  responses: Response[],
  rules: Rule[],
  targetClasses: string[],
  numProposals = 3,
  weights: AlgorithmWeights = DEFAULT_WEIGHTS,
  constraints: AlgorithmConstraints = DEFAULT_CONSTRAINTS,
  relationTypes: RelationTypeGroups = DEFAULT_RELATION_TYPES
): ProposalResult[] {
  const separationRules = rules.filter(r => r.rule_type === "must_separate" && r.active)
  const lockRules = rules.filter(r =>
    (r.rule_type === "lock_student_to_class" || r.rule_type === "with_tutor") && r.active
  )
  const excludeRules = rules.filter(r => r.rule_type === "exclude_student" && r.active)
  const mustTogetherRules = rules.filter(r => r.rule_type === "must_keep_together" && r.active)
  const shouldTogetherRules = rules.filter(r => r.rule_type === "should_keep_together" && r.active)
  const atLeastOneRules = rules.filter(r => r.rule_type === "keep_at_least_one" && r.active)
  const maxFromGroupRules = rules.filter(r => r.rule_type === "max_from_group" && r.active)
  const protectVulnerableRules = rules.filter(r => r.rule_type === "protect_vulnerable" && r.active)

  const excludedIds = new Set([
    ...excludeRules.flatMap(r => (r.students ?? []).map(rs => rs.student_id)),
    // Also respect excluded_from_mix field set directly on the student
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...students.filter(s => (s as any).excluded_from_mix).map(s => s.id),
  ])

  const lockedStudents = new Map<string, string>()
  lockRules.forEach(r => {
    if (r.target_class) {
      const cls = r.target_class
      ;(r.students ?? []).forEach(rs => lockedStudents.set(rs.student_id, cls))
    }
  })

  // Check for infeasible locked conflicts to report on all proposals
  const infeasibilityReport = checkInfeasibility(students, rules, targetClasses)
  const infeasibleRules = infeasibilityReport.feasible ? [] : infeasibilityReport.blocking_rules

  // Students who cannot be moved
  const mustTogetherLockedClass = new Map<string, string>()
  mustTogetherRules.forEach(r => {
    const ids = (r.students ?? []).map(rs => rs.student_id)
    const lockedInGroup = ids.filter(sid => lockedStudents.has(sid))
    if (lockedInGroup.length > 0) {
      const cls = lockedStudents.get(lockedInGroup[0])!
      ids.forEach(sid => mustTogetherLockedClass.set(sid, cls))
    }
  })

  // must_keep_together partners map: sid → Set of partner sids that must share a class
  const mustTogetherPartnersMap = new Map<string, Set<string>>()
  mustTogetherRules.forEach(r => {
    const ids = (r.students ?? []).map(rs => rs.student_id)
    ids.forEach(sid => {
      const partners = mustTogetherPartnersMap.get(sid) ?? new Set<string>()
      ids.forEach(pid => { if (pid !== sid) partners.add(pid) })
      mustTogetherPartnersMap.set(sid, partners)
    })
  })

  // Pre-compute friendship responses — needed by protectMap expansion and autoProtect
  const friendshipResps = responses.filter(r => relationTypes.friendshipLike.includes(r.relation_type))

  // keep_at_least_one: main student → list of friend options
  const atLeastOneMap = new Map<string, string[]>()
  atLeastOneRules.forEach(r => {
    const ids = (r.students ?? []).map(rs => rs.student_id)
    if (ids.length >= 2) atLeastOneMap.set(ids[0], ids.slice(1))
  })

  // protect_vulnerable: main student → companion options.
  // 1-student rules (the common AI-generated case) expand their sociometric choices as options
  // so the local search can still keep them with someone they elected or who elected them.
  const protectMap = new Map<string, string[]>()
  protectVulnerableRules.forEach(r => {
    const ids = (r.students ?? []).map(rs => rs.student_id)
    if (ids.length >= 2) {
      protectMap.set(ids[0], ids.slice(1))
    } else if (ids.length === 1) {
      const sid = ids[0]
      const options = friendshipResps
        .filter(resp => resp.respondent_student_id === sid || resp.target_student_id === sid)
        .map(resp => resp.respondent_student_id === sid ? resp.target_student_id : resp.respondent_student_id)
      const unique = [...new Set(options)]
      if (unique.length > 0) protectMap.set(sid, unique)
    }
  })

  // avoid_tutor: student must not go to the tutor's specific class
  const forbiddenClassMap = new Map<string, Set<string>>()
  rules
    .filter(r => r.rule_type === "avoid_tutor" && r.active && r.target_class)
    .forEach(r => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(r.students ?? []).forEach((rs: any) => {
        const set = forbiddenClassMap.get(rs.student_id) ?? new Set<string>()
        set.add(r.target_class!)
        forbiddenClassMap.set(rs.student_id, set)
      })
    })

  // Auto-detect fragile anchor pairs from response data without requiring explicit admin rules.
  // A student with exactly 1 reciprocal friendship partner and ≤3 received nominations
  // becomes isolated if separated from their only anchor — the algorithm must preserve that bond.
  // Explicit rules (protectMap / atLeastOneMap) always take precedence.
  const receivedNomCount = new Map<string, number>()
  friendshipResps.forEach(r => {
    receivedNomCount.set(r.target_student_id, (receivedNomCount.get(r.target_student_id) ?? 0) + 1)
  })
  const reciprocalPartnerMap = new Map<string, string[]>()
  friendshipResps.forEach(r => {
    const hasReverse = friendshipResps.some(
      f => f.respondent_student_id === r.target_student_id && f.target_student_id === r.respondent_student_id
    )
    if (hasReverse) {
      const list = reciprocalPartnerMap.get(r.respondent_student_id) ?? []
      if (!list.includes(r.target_student_id)) list.push(r.target_student_id)
      reciprocalPartnerMap.set(r.respondent_student_id, list)
    }
  })
  const autoProtectMap = new Map<string, string[]>()
  students.forEach(s => {
    if (protectMap.has(s.id) || atLeastOneMap.has(s.id)) return
    const recv = receivedNomCount.get(s.id) ?? 0
    const partners = reciprocalPartnerMap.get(s.id) ?? []
    if (partners.length === 1 && recv <= 3) {
      autoProtectMap.set(s.id, partners)
    }
  })

  // max_from_group: group key (sorted ids) → max per class
  const maxFromGroupMap = new Map<string, number>()
  maxFromGroupRules.forEach(r => {
    const ids = (r.students ?? []).map(rs => rs.student_id).sort()
    maxFromGroupMap.set(ids.join(","), r.max_count ?? 2)
  })

  const activeStudents = students.filter(s => !excludedIds.has(s.id))
  const freeStudents = activeStudents.filter(s => !lockedStudents.has(s.id) && !mustTogetherLockedClass.has(s.id))

  // Equal size cap: max students per class when enforce_equal_size is on
  const maxClassSize = constraints.enforce_equal_size
    ? Math.ceil(activeStudents.length / targetClasses.length)
    : Infinity

  // Pre-compute global gender ratio for constraint enforcement
  const totalF = activeStudents.filter(s => s.gender === "F").length
  const totalM = activeStudents.filter(s => s.gender === "M").length
  const totalGender = totalF + totalM
  const globalFRatio = totalGender > 0 ? totalF / totalGender : 0.5

  // Pre-compute origin class sizes for mix constraint
  const originSizes = new Map<string, number>()
  activeStudents.forEach(s => originSizes.set(s.current_class, (originSizes.get(s.current_class) ?? 0) + 1))

  function isOriginBlocked(assignments: AssignmentResult[], cls: string, unitIds: string[], studentMap: Map<string, Student>): boolean {
    if (!constraints.enforce_origin_mix) return false
    const maxPct = constraints.max_origin_pct / 100
    const classTotalAfter = assignments.filter(a => a.target_class === cls).length + unitIds.length
    if (classTotalAfter === 0) return false

    const originCounts = new Map<string, number>()
    assignments.filter(a => a.target_class === cls).forEach(a => {
      const s = studentMap.get(a.student_id)
      if (s) originCounts.set(s.current_class, (originCounts.get(s.current_class) ?? 0) + 1)
    })
    for (const uid of unitIds) {
      const s = studentMap.get(uid)
      if (!s) continue
      const newCount = (originCounts.get(s.current_class) ?? 0) + 1
      if (newCount / classTotalAfter > maxPct) return true
    }
    return false
  }

  function isGenderBlocked(assignments: AssignmentResult[], cls: string, unitIds: string[], studentMap: Map<string, Student>): boolean {
    if (!constraints.enforce_gender_balance) return false
    const tolerance = constraints.gender_tolerance / 100
    const classBefore = assignments.filter(a => a.target_class === cls)
    // Don't enforce on partially-filled classes — individual placements skew small samples.
    // Only check once the class is at least half its expected final size.
    const expectedSize = Math.ceil(activeStudents.length / targetClasses.length)
    if (classBefore.length < Math.floor(expectedSize / 2)) return false
    let f = classBefore.filter(a => studentMap.get(a.student_id)?.gender === "F").length
    let total = classBefore.length
    for (const uid of unitIds) {
      const s = studentMap.get(uid)
      if (!s) continue
      if (s.gender === "F") f++
      total++
    }
    if (total === 0) return false
    const ratio = f / total
    return Math.abs(ratio - globalFRatio) > tolerance
  }

  const proposals: ProposalResult[] = []
  const seen = new Set<string>()

  for (let seed = 0; seed < numProposals * 8 && proposals.length < numProposals; seed++) {
    const assignments: AssignmentResult[] = []
    const classCounts = new Map(targetClasses.map(c => [c, 0]))

    // 1. Locked students
    lockedStudents.forEach((cls, sid) => {
      if (targetClasses.includes(cls) && activeStudents.some(s => s.id === sid)) {
        assignments.push({ student_id: sid, target_class: cls })
        classCounts.set(cls, (classCounts.get(cls) ?? 0) + 1)
      }
    })

    // 2. must_keep_together students linked to a locked class
    mustTogetherLockedClass.forEach((cls, sid) => {
      if (!lockedStudents.has(sid) && activeStudents.some(s => s.id === sid)) {
        assignments.push({ student_id: sid, target_class: cls })
        classCounts.set(cls, (classCounts.get(cls) ?? 0) + 1)
      }
    })

    const alreadyAssigned = new Set(assignments.map(a => a.student_id))

    // 3. Build distribution units
    type Unit = { ids: string[] }
    const units: Unit[] = []
    const unitCovered = new Set<string>()

    // must_keep_together free groups (no locked member)
    mustTogetherRules.forEach(r => {
      const ids = (r.students ?? []).map(rs => rs.student_id)
      const free = ids.filter(
        sid => !alreadyAssigned.has(sid) && freeStudents.some(s => s.id === sid) && !unitCovered.has(sid)
      )
      if (free.length > 0) {
        units.push({ ids: free })
        free.forEach(sid => unitCovered.add(sid))
      }
    })

    // should_keep_together (applied on even seeds for variety)
    if (seed % 2 === 0) {
      shouldTogetherRules.forEach(r => {
        const ids = (r.students ?? []).map(rs => rs.student_id)
        const free = ids.filter(
          sid => !alreadyAssigned.has(sid) && freeStudents.some(s => s.id === sid) && !unitCovered.has(sid)
        )
        if (free.length > 0) {
          units.push({ ids: free })
          free.forEach(sid => unitCovered.add(sid))
        }
      })
    }

    // Remaining free students (grade-sorted + gender-interleaved on seed 0, shuffled otherwise).
    // Interleaving genders in the sorted order ensures the snake distributes F and M evenly
    // across classes regardless of any grade/gender correlation in the cohort.
    let sortedFree: Student[]
    if (seed === 0) {
      const byGrade = [...freeStudents].sort((a, b) => b.average_grade - a.average_grade)
      const sortedF = byGrade.filter(s => s.gender === "F")
      const sortedM = byGrade.filter(s => s.gender === "M")
      const sortedOther = byGrade.filter(s => s.gender !== "F" && s.gender !== "M")
      const interleaved: Student[] = []
      let fi = 0, mi = 0
      while (fi < sortedF.length || mi < sortedM.length) {
        // Proportional interleave: advance whichever gender is "behind" vs its share
        const addF = mi >= sortedM.length ||
          (fi < sortedF.length && fi * sortedM.length <= mi * sortedF.length)
        if (addF) interleaved.push(sortedF[fi++])
        else interleaved.push(sortedM[mi++])
      }
      sortedFree = [...interleaved, ...sortedOther]
    } else {
      sortedFree = shuffle([...freeStudents], seed * 12345)
    }

    sortedFree.forEach(s => {
      if (!alreadyAssigned.has(s.id) && !unitCovered.has(s.id)) {
        units.push({ ids: [s.id] })
      }
    })

    // 4. Snake distribution
    let direction = 1
    let classIdx = 0
    // Start at least loaded class
    let minCount = Infinity
    targetClasses.forEach((c, i) => {
      const cnt = classCounts.get(c) ?? 0
      if (cnt < minCount) {
        minCount = cnt
        classIdx = i
      }
    })

    const studentMapLocal = new Map(activeStudents.map(s => [s.id, s]))

    for (const unit of units) {
      let bestClass = targetClasses[classIdx]
      let retries = 0

      while (retries < targetClasses.length) {
        bestClass = targetClasses[classIdx]
        let blocked = false

        // must_separate check
        for (const rule of separationRules) {
          if (blocked) break
          const rIds = new Set((rule.students ?? []).map(rs => rs.student_id))
          const unitInRule = unit.ids.some(sid => rIds.has(sid))
          if (!unitInRule) continue
          const allConflicts = unit.ids
            .filter(sid => rIds.has(sid))
            .flatMap(sid => [...rIds].filter(pid => pid !== sid))
          if (
            allConflicts.some(pid =>
              assignments.some(a => a.student_id === pid && a.target_class === bestClass)
            )
          ) {
            blocked = true
          }
        }

        // max_from_group check
        if (!blocked) {
          for (const [groupKey, maxCount] of maxFromGroupMap) {
            if (blocked) break
            const groupIds = new Set(groupKey.split(","))
            const unitInGroup = unit.ids.filter(sid => groupIds.has(sid)).length
            if (unitInGroup === 0) continue
            const currentInClass = assignments.filter(
              a => a.target_class === bestClass && groupIds.has(a.student_id)
            ).length
            if (currentInClass + unitInGroup > maxCount) blocked = true
          }
        }

        // origin mix constraint
        if (!blocked && isOriginBlocked(assignments, bestClass, unit.ids, studentMapLocal)) {
          blocked = true
        }

        // gender balance constraint
        if (!blocked && isGenderBlocked(assignments, bestClass, unit.ids, studentMapLocal)) {
          blocked = true
        }

        // equal size constraint: don't exceed Math.ceil(N/K)
        if (!blocked && (classCounts.get(bestClass) ?? 0) + unit.ids.length > maxClassSize) {
          blocked = true
        }

        // avoid_tutor: no unit member may go to their forbidden class
        if (!blocked && unit.ids.some(sid => forbiddenClassMap.get(sid)?.has(bestClass))) {
          blocked = true
        }

        if (!blocked) break

        // Advance to next class
        if (direction === 1) {
          classIdx = (classIdx + 1) % targetClasses.length
        } else {
          classIdx = (classIdx - 1 + targetClasses.length) % targetClasses.length
        }
        retries++
      }

      unit.ids.forEach(sid => {
        assignments.push({ student_id: sid, target_class: bestClass })
        classCounts.set(bestClass, (classCounts.get(bestClass) ?? 0) + 1)
      })

      // Advance snake
      if (direction === 1) {
        if (classIdx === targetClasses.length - 1) direction = -1
        else classIdx++
      } else {
        if (classIdx === 0) direction = 1
        else classIdx--
      }
    }

    // 4.5 Rebalancing pass: when enforce_equal_size is on, other active constraints (origin_mix,
    // gender_balance) can force fallback placements that break the snake's rhythm and create
    // classes that differ by > 1. Move non-locked students from over-full to under-full classes.
    if (constraints.enforce_equal_size) {
      let rebalanced = true
      while (rebalanced) {
        rebalanced = false
        let bigClass = targetClasses[0]
        let smallClass = targetClasses[0]
        targetClasses.forEach(c => {
          if ((classCounts.get(c) ?? 0) > (classCounts.get(bigClass) ?? 0)) bigClass = c
          if ((classCounts.get(c) ?? 0) < (classCounts.get(smallClass) ?? 0)) smallClass = c
        })
        if ((classCounts.get(bigClass) ?? 0) - (classCounts.get(smallClass) ?? 0) <= 1) break

        const movable = assignments.filter(
          a =>
            a.target_class === bigClass &&
            !lockedStudents.has(a.student_id) &&
            !mustTogetherLockedClass.has(a.student_id) &&
            // Don't separate must_keep_together partners during rebalancing
            ![...(mustTogetherPartnersMap.get(a.student_id) ?? [])].some(
              pid => assignments.some(pa => pa.student_id === pid && pa.target_class === bigClass)
            )
        )
        let moved = false
        for (const candidate of movable) {
          const sepOk = !separationRules.some(r => {
            const rIds = new Set((r.students ?? []).map(rs => rs.student_id))
            if (!rIds.has(candidate.student_id)) return false
            return assignments.some(
              a => a.target_class === smallClass && a.student_id !== candidate.student_id && rIds.has(a.student_id)
            )
          })
          if (!sepOk) continue
          if (forbiddenClassMap.get(candidate.student_id)?.has(smallClass)) continue
          const idx = assignments.findIndex(a => a.student_id === candidate.student_id)
          if (idx === -1) continue
          assignments[idx].target_class = smallClass
          classCounts.set(bigClass, (classCounts.get(bigClass) ?? 1) - 1)
          classCounts.set(smallClass, (classCounts.get(smallClass) ?? 0) + 1)
          moved = true
          rebalanced = true
          break
        }
        if (!moved) break
      }
    }

    // 5. Local search: satisfy keep_at_least_one, protect_vulnerable, and auto-detected fragile pairs
    const assignMut = new Map(assignments.map(a => [a.student_id, a]))
    const combinedNeeds = [
      ...atLeastOneMap.entries(),
      ...protectMap.entries(),
      ...autoProtectMap.entries(),
    ]

    for (const [mainId, friendIds] of combinedNeeds) {
      const mainAssign = assignMut.get(mainId)
      if (!mainAssign) continue
      const myClass = mainAssign.target_class

      const hasFriend = friendIds.some(fid => assignMut.get(fid)?.target_class === myClass)
      if (hasFriend) continue

      // Try swapping a friend into myClass by exchanging with a movable student
      for (const fid of friendIds) {
        const friendAssign = assignMut.get(fid)
        if (!friendAssign || friendAssign.target_class === myClass) continue
        const friendClass = friendAssign.target_class

        // Find a candidate in myClass to swap out (must not violate separations or must_keep_together)
        const candidates = assignments.filter(
          a =>
            a.target_class === myClass &&
            a.student_id !== mainId &&
            !lockedStudents.has(a.student_id) &&
            !mustTogetherLockedClass.has(a.student_id) &&
            // Don't move a student away from their must_keep_together partner
            ![...(mustTogetherPartnersMap.get(a.student_id) ?? [])].some(
              pid => assignments.some(pa => pa.student_id === pid && pa.target_class === myClass)
            )
        )

        for (const candidate of candidates) {
          const swapOk = !separationRules.some(r => {
            const rIds = new Set((r.students ?? []).map(rs => rs.student_id))
            if (rIds.has(fid)) {
              return assignments.some(
                a => a.target_class === myClass && a.student_id !== candidate.student_id && rIds.has(a.student_id)
              )
            }
            if (rIds.has(candidate.student_id)) {
              return assignments.some(
                a => a.target_class === friendClass && a.student_id !== fid && rIds.has(a.student_id)
              )
            }
            return false
          })

          const maxGroupOk = swapOk && ![...maxFromGroupMap.entries()].some(([groupKey, maxCount]) => {
            const groupIds = new Set(groupKey.split(","))
            if (groupIds.has(fid)) {
              const afterCount = assignments.filter(
                a => a.target_class === myClass && a.student_id !== candidate.student_id && groupIds.has(a.student_id)
              ).length + 1
              if (afterCount > maxCount) return true
            }
            if (groupIds.has(candidate.student_id)) {
              const afterCount = assignments.filter(
                a => a.target_class === friendClass && a.student_id !== fid && groupIds.has(a.student_id)
              ).length + 1
              if (afterCount > maxCount) return true
            }
            return false
          })

          const forbiddenOk = maxGroupOk &&
            !forbiddenClassMap.get(fid)?.has(myClass) &&
            !forbiddenClassMap.get(candidate.student_id)?.has(friendClass)

          // Don't move fid away from its must_keep_together partners in friendClass
          const fidKeepOk = forbiddenOk &&
            ![...(mustTogetherPartnersMap.get(fid) ?? [])].some(
              pid => pid !== candidate.student_id && assignments.some(
                pa => pa.student_id === pid && pa.target_class === friendClass
              )
            )

          if (fidKeepOk) {
            // Swap: friend → myClass, candidate → friendClass
            const fidIdx = assignments.findIndex(a => a.student_id === fid)
            const candIdx = assignments.findIndex(a => a.student_id === candidate.student_id)
            if (fidIdx !== -1) assignments[fidIdx].target_class = myClass
            if (candIdx !== -1) assignments[candIdx].target_class = friendClass
            assignMut.set(fid, assignments[fidIdx])
            assignMut.set(candidate.student_id, assignments[candIdx])
            break
          }
        }

        if (friendIds.some(fid2 => assignMut.get(fid2)?.target_class === myClass)) break
      }
    }

    // 6. General swap local search
    const maxIter = Math.min(300, activeStudents.length * 3)
    let bestScore = computeScore(assignments, activeStudents, responses, rules, targetClasses, weights, relationTypes)

    const swappable = assignments.filter(
      a => !lockedStudents.has(a.student_id) && !mustTogetherLockedClass.has(a.student_id)
    )

    if (swappable.length >= 2) for (let iter = 0; iter < maxIter; iter++) {
      const s1 = (seed * 999983 + iter * 7919) & 0x7fffffff
      const s2 = (s1 * 1664525 + 1013904223) & 0x7fffffff
      const i = s1 % swappable.length
      const j = s2 % swappable.length
      if (i === j) continue

      const a1 = swappable[i]
      const a2 = swappable[j]
      if (a1.target_class === a2.target_class) continue

      const orig1 = a1.target_class
      const orig2 = a2.target_class

      // Check separation rules for swap validity
      const swapOk = !separationRules.some(r => {
        const rIds = new Set((r.students ?? []).map(rs => rs.student_id))
        if (rIds.has(a1.student_id)) {
          const conflictInOrig2 = assignments.some(
            a => a.target_class === orig2 && a.student_id !== a2.student_id && rIds.has(a.student_id)
          )
          if (conflictInOrig2) return true
        }
        if (rIds.has(a2.student_id)) {
          const conflictInOrig1 = assignments.some(
            a => a.target_class === orig1 && a.student_id !== a1.student_id && rIds.has(a.student_id)
          )
          if (conflictInOrig1) return true
        }
        return false
      })

      if (!swapOk) continue

      // max_from_group: ensure swap doesn't push a group over its cap in either class
      const maxGroupOk = ![...maxFromGroupMap.entries()].some(([groupKey, maxCount]) => {
        const groupIds = new Set(groupKey.split(","))
        if (groupIds.has(a1.student_id)) {
          const afterInOrig2 = assignments.filter(
            a => a.target_class === orig2 && a.student_id !== a2.student_id && groupIds.has(a.student_id)
          ).length + 1
          if (afterInOrig2 > maxCount) return true
        }
        if (groupIds.has(a2.student_id)) {
          const afterInOrig1 = assignments.filter(
            a => a.target_class === orig1 && a.student_id !== a1.student_id && groupIds.has(a.student_id)
          ).length + 1
          if (afterInOrig1 > maxCount) return true
        }
        return false
      })

      if (!maxGroupOk) continue

      // avoid_tutor: neither student may land in their forbidden class
      if (forbiddenClassMap.get(a1.student_id)?.has(orig2)) continue
      if (forbiddenClassMap.get(a2.student_id)?.has(orig1)) continue

      // must_keep_together: don't move a student away from their mandatory partner
      const keepTogetherOk =
        ![...(mustTogetherPartnersMap.get(a1.student_id) ?? [])].some(
          pid => pid !== a2.student_id && assignments.some(a => a.student_id === pid && a.target_class === orig1)
        ) &&
        ![...(mustTogetherPartnersMap.get(a2.student_id) ?? [])].some(
          pid => pid !== a1.student_id && assignments.some(a => a.student_id === pid && a.target_class === orig2)
        )
      if (!keepTogetherOk) continue

      a1.target_class = orig2
      a2.target_class = orig1
      const newScore = computeScore(assignments, activeStudents, responses, rules, targetClasses, weights, relationTypes)

      if (newScore > bestScore) {
        bestScore = newScore
      } else {
        a1.target_class = orig1
        a2.target_class = orig2
      }
    }

    // 7. Isolation repair pass — best-effort: ensure every student has ≥1 friendship bond in their class.
    // Uses a BIDIRECTIONAL friendship map (A chose B OR B chose A = they have a bond), matching the
    // updated avoid_isolation metric in computeSubScores and buildResult. Does NOT include work relations.
    if (constraints.enforce_no_isolation) {
      // Bidirectional friendship map: both A→B and B→A for every friendship response
      const dirFriendMap = new Map<string, Set<string>>()
      friendshipResps.forEach(r => {
        let setA = dirFriendMap.get(r.respondent_student_id)
        if (!setA) { setA = new Set(); dirFriendMap.set(r.respondent_student_id, setA) }
        setA.add(r.target_student_id)
        let setB = dirFriendMap.get(r.target_student_id)
        if (!setB) { setB = new Set(); dirFriendMap.set(r.target_student_id, setB) }
        setB.add(r.respondent_student_id)
      })

      const clsOf = (sid: string) => assignments.find(a => a.student_id === sid)?.target_class
      // Student is "covered" if they have at least one friendship bond (either direction) in the same class
      const hasChosen = (sid: string, cls: string) =>
        [...(dirFriendMap.get(sid) ?? [])].some(cid => clsOf(cid) === cls)
      const isMovable = (sid: string) => !lockedStudents.has(sid) && !mustTogetherLockedClass.has(sid)
      const repairSepOk = (sid: string, toCls: string) =>
        !separationRules.some(r => {
          const rIds = new Set((r.students ?? []).map(rs => rs.student_id))
          if (!rIds.has(sid)) return false
          return assignments.some(a => a.target_class === toCls && a.student_id !== sid && rIds.has(a.student_id))
        })
      const repairKeepOk = (sid: string, fromCls: string) =>
        ![...(mustTogetherPartnersMap.get(sid) ?? [])].some(
          pid => assignments.some(pa => pa.student_id === pid && pa.target_class === fromCls)
        )
      const repairSizeOk = (fromCls: string, toCls: string) => {
        if (!constraints.enforce_equal_size) return true
        return (classCounts.get(fromCls) ?? 0) > (classCounts.get(toCls) ?? 0)
      }
      // Respect gender balance when enforce_gender_balance is on.
      // Checks that placing sid in toCls stays within the configured tolerance.
      const repairGenderOk = (sid: string, toCls: string) => {
        if (!constraints.enforce_gender_balance) return true
        const s = studentMapLocal.get(sid)
        if (!s || (s.gender !== "F" && s.gender !== "M")) return true
        const tolerance = constraints.gender_tolerance / 100
        const inTo = assignments.filter(a => a.target_class === toCls && a.student_id !== sid)
        let f = inTo.filter(a => studentMapLocal.get(a.student_id)?.gender === "F").length
        let total = inTo.length
        if (s.gender === "F") f++
        total++
        if (total === 0) return true
        return Math.abs(f / total - globalFRatio) <= tolerance
      }
      // Would moving `sid` OUT of `cls` leave anyone there without a chosen friend?
      // Uses the directional map: only checks students who actively CHOSE sid.
      const wouldIsolateSomeoneIn = (sid: string, cls: string) =>
        assignments.some(a => {
          if (a.student_id === sid || a.target_class !== cls) return false
          const chosen = dirFriendMap.get(a.student_id)
          if (!chosen?.has(sid)) return false
          return [...chosen].every(cid => cid === sid || clsOf(cid) !== cls)
        })
      const doMove = (sid: string, fromCls: string, toCls: string) => {
        const idx = assignments.findIndex(a => a.student_id === sid)
        if (idx !== -1) {
          assignments[idx].target_class = toCls
          classCounts.set(fromCls, (classCounts.get(fromCls) ?? 1) - 1)
          classCounts.set(toCls, (classCounts.get(toCls) ?? 0) + 1)
        }
      }

      // Isolated = no friendship bond (either direction) in current class
      const isolated = assignments.filter(a => !hasChosen(a.student_id, a.target_class))

      for (const iso of isolated) {
        const sid = iso.student_id
        let myCls = clsOf(sid)
        if (!myCls || hasChosen(sid, myCls)) continue // fixed by a previous iteration

        const myChosen = [...(dirFriendMap.get(sid) ?? [])]
        if (myChosen.length === 0) continue // made no friendship choices — placement can't help

        // Option A: move this student to a class where they chose someone
        if (isMovable(sid) && repairKeepOk(sid, myCls)) {
          const targets = targetClasses
            .filter(cls => cls !== myCls && hasChosen(sid, cls))
            .sort((a, b) =>
              myChosen.filter(c => clsOf(c) === b).length - myChosen.filter(c => clsOf(c) === a).length
            )
          for (const toCls of targets) {
            if (!repairSepOk(sid, toCls)) continue
            if (forbiddenClassMap.get(sid)?.has(toCls)) continue
            if (!repairSizeOk(myCls, toCls)) continue
            if (!repairGenderOk(sid, toCls)) continue
            doMove(sid, myCls, toCls)
            myCls = toCls
            break
          }
        }

        // Re-check: option A may have fixed it
        const nowCls = clsOf(sid)
        if (!nowCls || hasChosen(sid, nowCls)) continue

        // Option B: bring one of the people this student chose to their class.
        // Prefer those who have many other chosen friends in their current class (least disruptive to move).
        const movableChosen = myChosen
          .filter(cid => {
            const cCls = clsOf(cid)
            return cCls && cCls !== nowCls && isMovable(cid)
          })
          .sort((a, b) => {
            const aOthers = [...(dirFriendMap.get(a) ?? [])].filter(c => clsOf(c) === clsOf(a)).length
            const bOthers = [...(dirFriendMap.get(b) ?? [])].filter(c => clsOf(c) === clsOf(b)).length
            return bOthers - aOthers
          })

        for (const connId of movableChosen) {
          const connCls = clsOf(connId)
          if (!connCls) continue
          if (!repairSepOk(connId, nowCls)) continue
          if (forbiddenClassMap.get(connId)?.has(nowCls)) continue
          if (!repairKeepOk(connId, connCls)) continue
          if (!repairSizeOk(connCls, nowCls)) continue
          if (!repairGenderOk(connId, nowCls)) continue
          if (wouldIsolateSomeoneIn(connId, connCls)) continue
          doMove(connId, connCls, nowCls)
          break
        }
      }
    }

    // Dedup by fingerprint
    const key = assignments.map(a => `${a.student_id}:${a.target_class}`).sort().join("|")
    if (seen.has(key)) continue
    seen.add(key)

    const result = buildResult(
      assignments,
      activeStudents,
      responses,
      rules,
      targetClasses,
      weights,
      infeasibleRules,
      relationTypes
    )
    proposals.push({ assignments: [...assignments], ...result })
  }

  return proposals.sort((a, b) => b.score_total - a.score_total).slice(0, numProposals)
}
