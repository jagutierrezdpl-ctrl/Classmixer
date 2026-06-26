import type { Student } from "@/types"

export interface GroupConfig {
  numGroups: number
  balanceGender: boolean
  balanceAcademic: boolean
  useSociogram: boolean
  maxPerGroup?: number // optional cap on group size; auto-increases numGroups if needed
  // Explicit per-group sizes, e.g. [4,4,4,3,3,3]. When set, overrides numGroups/maxPerGroup.
  groupSizes?: number[]
  // Social data loaded when useSociogram=true
  socialConnections?: Map<string, Set<string>> // studentId → students chosen (friendship/work)
  socialConflicts?: Map<string, Set<string>>   // studentId → conflict students (negative)
  // Always used when available (independent of useSociogram)
  previousGroupings?: Map<string, Set<string>> // studentId → students grouped with before
  // Hard constraints from cooperative rules
  mustSeparate?: Array<[string, string]>        // pairs that must be in different groups
  mustKeepTogether?: Array<[string, string]>    // pairs that should be in the same group
}

export interface GroupResult {
  assignments: { student_id: string; group_number: number; role: string | null }[]
  score_total: number
}

const LEVEL_ORDER: Record<string, number> = {
  "Alto": 4, "Medio-alto": 3, "Medio": 2, "Medio-bajo": 1, "Bajo": 0
}

function academicScore(s: Student): number {
  if (s.academic_level && LEVEL_ORDER[s.academic_level] !== undefined) {
    return LEVEL_ORDER[s.academic_level]
  }
  return s.average_grade ?? 5
}

function shuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr]
  let s = seed
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    const j = Math.abs(s) % (i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function scoreGroups(groups: Student[][], config: GroupConfig): number {
  let score = 100
  if (groups.length === 0) return 0

  const allStudents = groups.flat()
  const totalStudents = allStudents.length
  const globalF = allStudents.filter(s => s.gender === "F").length
  const globalFRatio = totalStudents > 0 ? globalF / totalStudents : 0.5

  for (const g of groups) {
    if (g.length === 0) continue

    if (config.balanceGender) {
      const f = g.filter(s => s.gender === "F").length
      const dev = Math.abs(f / g.length - globalFRatio)
      score -= dev * 50
    }

    if (config.balanceAcademic) {
      const levels = g.map(s => academicScore(s))
      const mean = levels.reduce((a, b) => a + b, 0) / levels.length
      const variance = levels.reduce((a, b) => a + (b - mean) ** 2, 0) / levels.length
      score += Math.min(variance / 2, 10)
    }

    // Per-pair social scoring
    const ids = g.map(s => s.id)
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = ids[i], b = ids[j]

        if (config.useSociogram) {
          const connected =
            config.socialConnections?.get(a)?.has(b) ||
            config.socialConnections?.get(b)?.has(a)
          if (connected) score += 3

          const conflict =
            config.socialConflicts?.get(a)?.has(b) ||
            config.socialConflicts?.get(b)?.has(a)
          if (conflict) score -= 8
        }

        // Anti-repetition (always applied when data is available)
        const repeated =
          config.previousGroupings?.get(a)?.has(b) ||
          config.previousGroupings?.get(b)?.has(a)
        if (repeated) score -= 2

        // Cooperative rules
        const separated = config.mustSeparate?.some(([x, y]) => (x === a && y === b) || (x === b && y === a))
        if (separated) score -= 50
        const kept = config.mustKeepTogether?.some(([x, y]) => (x === a && y === b) || (x === b && y === a))
        if (kept) score += 15
      }
    }
  }

  return Math.max(0, score)
}

// Repair pass: swap students to fix must_separate violations.
// Modifies groups in place; returns true if all violations are resolved.
function repairSeparations(groups: Student[][], mustSeparate: Array<[string, string]>): boolean {
  let improved = true
  let passes = 0
  while (improved && passes < 30) {
    improved = false
    passes++
    for (const [aId, bId] of mustSeparate) {
      // Find which groups contain each student
      const gA = groups.findIndex(g => g.some(s => s.id === aId))
      const gB = groups.findIndex(g => g.some(s => s.id === bId))
      if (gA === -1 || gB === -1 || gA !== gB) continue // already separated or not found
      // They're in the same group — try to move B to a different group
      const sB = groups[gA].find(s => s.id === bId)!
      // Find target group: prefer one that doesn't also contain conflicting pairs with sB
      let moved = false
      for (let t = 0; t < groups.length; t++) {
        if (t === gA) continue
        const wouldViolate = mustSeparate.some(([x, y]) => {
          const partner = x === bId ? y : y === bId ? x : null
          return partner && groups[t].some(s => s.id === partner)
        })
        if (!wouldViolate) {
          groups[gA] = groups[gA].filter(s => s.id !== bId)
          // Swap with the last student of target group to keep sizes balanced
          const swapped = groups[t][groups[t].length - 1]
          groups[t] = [...groups[t].slice(0, -1), sB]
          groups[gA] = [...groups[gA], swapped]
          improved = true
          moved = true
          break
        }
      }
      if (!moved) {
        // Last resort: just move without swapping (sizes will differ by 1)
        groups[gA] = groups[gA].filter(s => s.id !== bId)
        const target = groups.reduce((best, g, i) => i !== gA && g.length < groups[best].length ? i : best, (gA + 1) % groups.length)
        groups[target] = [...groups[target], sB]
        improved = true
      }
    }
  }
  // Check if all violations resolved
  return mustSeparate.every(([a, b]) => {
    const gA = groups.findIndex(g => g.some(s => s.id === a))
    const gB = groups.findIndex(g => g.some(s => s.id === b))
    return gA === -1 || gB === -1 || gA !== gB
  })
}

export function generateGroups(students: Student[], config: GroupConfig, seed = 0): GroupResult {
  if (students.length === 0 || config.numGroups < 1) {
    return { assignments: [], score_total: 0 }
  }

  const base = seed === 0
    ? [...students].sort((a, b) => academicScore(b) - academicScore(a))
    : shuffle([...students], seed * 12345 + 7)

  let sortedStudents: Student[]

  if (config.balanceGender) {
    const females = base.filter(s => s.gender === "F")
    const males = base.filter(s => s.gender === "M")
    const others = base.filter(s => s.gender !== "F" && s.gender !== "M")
    if (seed === 0) {
      females.sort((a, b) => academicScore(b) - academicScore(a))
      males.sort((a, b) => academicScore(b) - academicScore(a))
    }
    const interleaved: Student[] = []
    let fi = 0, mi = 0
    while (fi < females.length || mi < males.length) {
      const addF = mi >= males.length || (fi < females.length && fi * males.length <= mi * females.length)
      if (addF) interleaved.push(females[fi++])
      else interleaved.push(males[mi++])
    }
    sortedStudents = [...interleaved, ...others]
  } else {
    sortedStudents = base
  }

  let groups: Student[][]

  if (config.groupSizes && config.groupSizes.length > 0) {
    // Variable-size mode: fill each group up to its target capacity using snake order
    const capacities = [...config.groupSizes]
    groups = capacities.map(() => [])
    // Snake-fill respecting per-group capacities
    let dir = 1
    let gi = 0
    for (const student of sortedStudents) {
      // Advance to next group with remaining capacity
      let attempts = 0
      while (groups[gi].length >= capacities[gi] && attempts < capacities.length) {
        gi = (gi + dir + capacities.length) % capacities.length
        attempts++
      }
      groups[gi].push(student)
      // Move to next group in snake direction
      if (dir === 1) {
        if (gi === capacities.length - 1) dir = -1
        else gi++
      } else {
        if (gi === 0) dir = 1
        else gi--
      }
    }
  } else {
    // Uniform-size mode (original logic)
    const minGroupsNeeded = config.maxPerGroup
      ? Math.ceil(students.length / config.maxPerGroup)
      : 1
    const numGroups = Math.min(Math.max(config.numGroups, minGroupsNeeded), students.length)
    groups = Array.from({ length: numGroups }, () => [])
    let direction = 1
    let gIdx = 0
    for (const student of sortedStudents) {
      groups[gIdx].push(student)
      if (direction === 1) {
        if (gIdx === numGroups - 1) direction = -1
        else gIdx++
      } else {
        if (gIdx === 0) direction = 1
        else gIdx--
      }
    }
  }

  // Apply repair pass for hard must_separate constraints
  if (config.mustSeparate && config.mustSeparate.length > 0) {
    repairSeparations(groups, config.mustSeparate)
  }

  const score = scoreGroups(groups, config)

  const ROLES = ["coordinador", "secretario", "portavoz", "revisor"]
  const assignments: GroupResult["assignments"] = []
  groups.forEach((group, gi) => {
    group.forEach((student, memberIdx) => {
      assignments.push({
        student_id: student.id,
        group_number: gi + 1,
        role: memberIdx < ROLES.length ? ROLES[memberIdx] : null,
      })
    })
  })

  return { assignments, score_total: score }
}

export function generateBestGroups(students: Student[], config: GroupConfig, tries = 10): GroupResult {
  let best: GroupResult = { assignments: [], score_total: -1 }
  for (let seed = 0; seed < tries; seed++) {
    const result = generateGroups(students, config, seed)
    if (result.score_total > best.score_total) best = result
  }
  return best
}
