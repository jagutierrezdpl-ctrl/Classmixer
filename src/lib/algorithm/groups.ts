import type { Student } from "@/types"

export interface GroupConfig {
  numGroups: number
  balanceGender: boolean
  balanceAcademic: boolean
  useSociogram: boolean
  // Social data loaded when useSociogram=true
  socialConnections?: Map<string, Set<string>> // studentId → students chosen (friendship/work)
  socialConflicts?: Map<string, Set<string>>   // studentId → conflict students (negative)
  // Always used when available (independent of useSociogram)
  previousGroupings?: Map<string, Set<string>> // studentId → students grouped with before
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
      }
    }
  }

  return Math.max(0, score)
}

export function generateGroups(students: Student[], config: GroupConfig, seed = 0): GroupResult {
  if (students.length === 0 || config.numGroups < 1) {
    return { assignments: [], score_total: 0 }
  }

  const numGroups = Math.min(config.numGroups, students.length)

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

  const groups: Student[][] = Array.from({ length: numGroups }, () => [])
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
