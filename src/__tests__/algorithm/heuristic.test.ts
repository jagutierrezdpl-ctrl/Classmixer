import { describe, it, expect } from "vitest"
import {
  generateProposals,
  checkInfeasibility,
  DEFAULT_CONSTRAINTS,
} from "@/lib/algorithm/heuristic"
import { DEFAULT_WEIGHTS } from "@/lib/algorithm/weights"
import type { Student, Response, Rule } from "@/types"

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeStudent(id: string, overrides: Partial<Student> = {}): Student {
  return {
    id,
    process_id: "p1",
    external_id: id,
    first_name: `Nombre_${id}`,
    last_name: `Apellido_${id}`,
    current_class: "6A",
    gender: "F",
    average_grade: 6,
    academic_level: "Medio",
    behavior_level: "Normal",
    needs_type: "No",
    observations: undefined,
    tutor: undefined,
    active: true,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

function makeRule(id: string, rule_type: string, studentIds: string[], overrides: Partial<Rule> = {}): Rule {
  return {
    id,
    process_id: "p1",
    rule_type: rule_type as Rule["rule_type"],
    priority: "alta",
    description: `Regla ${id}`,
    active: true,
    created_by: "user1",
    created_at: new Date().toISOString(),
    students: studentIds.map((sid, i) => ({ id: `rs_${id}_${i}`, rule_id: id, student_id: sid })),
    target_class: undefined,
    max_count: undefined,
    ...overrides,
  }
}

// 10 students, 2 classes
const TEN_STUDENTS = Array.from({ length: 10 }, (_, i) =>
  makeStudent(`s${i + 1}`, {
    gender: i % 2 === 0 ? "F" : "M",
    average_grade: 5 + i * 0.3,
    current_class: i < 5 ? "6A" : "6B",
  })
)
const TWO_CLASSES = ["1A", "1B"]
const NO_RESPONSES: Response[] = []
const NO_RULES: Rule[] = []

// ── checkInfeasibility ────────────────────────────────────────────────────────

describe("checkInfeasibility", () => {
  it("returns feasible when there are no rules and enough students", () => {
    const result = checkInfeasibility(TEN_STUDENTS, NO_RULES, TWO_CLASSES)
    expect(result.feasible).toBe(true)
    expect(result.blocking_rules).toHaveLength(0)
  })

  it("detects impossible conflict: must_separate + both students locked to same class", () => {
    const students = TEN_STUDENTS
    const rules: Rule[] = [
      makeRule("r1", "must_separate", ["s1", "s2"]),
      makeRule("r2", "lock_student_to_class", ["s1"], { target_class: "1A" }),
      makeRule("r3", "lock_student_to_class", ["s2"], { target_class: "1A" }),
    ]
    const result = checkInfeasibility(students, rules, TWO_CLASSES)
    expect(result.feasible).toBe(false)
    expect(result.blocking_rules.length).toBeGreaterThan(0)
    expect(result.explanation[0]).toContain("bloqueados en la misma clase")
  })

  it("is feasible when must_separate students are locked to different classes", () => {
    const rules: Rule[] = [
      makeRule("r1", "must_separate", ["s1", "s2"]),
      makeRule("r2", "lock_student_to_class", ["s1"], { target_class: "1A" }),
      makeRule("r3", "lock_student_to_class", ["s2"], { target_class: "1B" }),
    ]
    const result = checkInfeasibility(TEN_STUDENTS, rules, TWO_CLASSES)
    expect(result.feasible).toBe(true)
  })

  it("detects must_keep_together conflict when students locked to different classes", () => {
    const rules: Rule[] = [
      makeRule("r1", "must_keep_together", ["s1", "s2"]),
      makeRule("r2", "lock_student_to_class", ["s1"], { target_class: "1A" }),
      makeRule("r3", "lock_student_to_class", ["s2"], { target_class: "1B" }),
    ]
    const result = checkInfeasibility(TEN_STUDENTS, rules, TWO_CLASSES)
    expect(result.feasible).toBe(false)
    expect(result.explanation[0]).toContain("clases distintas")
  })

  it("detects infeasibility when no target classes configured", () => {
    const result = checkInfeasibility(TEN_STUDENTS, NO_RULES, [])
    expect(result.feasible).toBe(false)
    expect(result.explanation[0]).toContain("No hay clases destino")
  })

  it("detects too few students for number of classes", () => {
    const twoStudents = [makeStudent("s1"), makeStudent("s2")]
    const result = checkInfeasibility(twoStudents, NO_RULES, ["1A", "1B", "1C", "1D"])
    expect(result.feasible).toBe(false)
    expect(result.explanation[0]).toContain("alumnos activos")
  })
})

// ── generateProposals ─────────────────────────────────────────────────────────

describe("generateProposals", () => {
  it("returns the requested number of proposals", () => {
    const proposals = generateProposals(TEN_STUDENTS, NO_RESPONSES, NO_RULES, TWO_CLASSES, 3)
    expect(proposals).toHaveLength(3)
  })

  it("assigns every student to exactly one class", () => {
    const proposals = generateProposals(TEN_STUDENTS, NO_RESPONSES, NO_RULES, TWO_CLASSES, 1)
    const [proposal] = proposals
    expect(proposal.assignments).toHaveLength(TEN_STUDENTS.length)
    const assigned = new Set(proposal.assignments.map(a => a.student_id))
    TEN_STUDENTS.forEach(s => expect(assigned.has(s.id)).toBe(true))
  })

  it("each assignment points to a valid target class", () => {
    const proposals = generateProposals(TEN_STUDENTS, NO_RESPONSES, NO_RULES, TWO_CLASSES, 2)
    proposals.forEach(p => {
      p.assignments.forEach(a => {
        expect(TWO_CLASSES).toContain(a.target_class)
      })
    })
  })

  it("score_total is between 0 and 100", () => {
    const proposals = generateProposals(TEN_STUDENTS, NO_RESPONSES, NO_RULES, TWO_CLASSES, 3)
    proposals.forEach(p => {
      expect(p.score_total).toBeGreaterThanOrEqual(0)
      expect(p.score_total).toBeLessThanOrEqual(100)
    })
  })

  it("respects must_separate rules (students not in same class)", () => {
    const rules: Rule[] = [makeRule("r1", "must_separate", ["s1", "s2"])]
    const proposals = generateProposals(TEN_STUDENTS, NO_RESPONSES, rules, TWO_CLASSES, 5)
    proposals.forEach(p => {
      const s1Class = p.assignments.find(a => a.student_id === "s1")?.target_class
      const s2Class = p.assignments.find(a => a.student_id === "s2")?.target_class
      expect(s1Class).not.toEqual(s2Class)
    })
  })

  it("respects lock_student_to_class rules", () => {
    const rules: Rule[] = [
      makeRule("r1", "lock_student_to_class", ["s1"], { target_class: "1A" }),
    ]
    const proposals = generateProposals(TEN_STUDENTS, NO_RESPONSES, rules, TWO_CLASSES, 3)
    proposals.forEach(p => {
      const s1Assignment = p.assignments.find(a => a.student_id === "s1")
      expect(s1Assignment?.target_class).toBe("1A")
    })
  })

  it("produces balanced grade averages across classes (variance < 1)", () => {
    const students = Array.from({ length: 20 }, (_, i) =>
      makeStudent(`s${i + 1}`, { average_grade: i < 10 ? 9 : 5 })
    )
    const proposals = generateProposals(students, NO_RESPONSES, NO_RULES, TWO_CLASSES, 3)
    const best = proposals[0]
    const classGrades: Record<string, number[]> = { "1A": [], "1B": [] }
    best.assignments.forEach(a => {
      const s = students.find(st => st.id === a.student_id)!
      classGrades[a.target_class].push(s.average_grade)
    })
    const means = Object.values(classGrades).map(
      gs => gs.reduce((s, g) => s + g, 0) / gs.length
    )
    const diff = Math.abs(means[0] - means[1])
    // With snake distribution, diff should be very small
    expect(diff).toBeLessThan(1)
  })

  it("includes metrics for each target class", () => {
    const proposals = generateProposals(TEN_STUDENTS, NO_RESPONSES, NO_RULES, TWO_CLASSES, 1)
    const [p] = proposals
    expect(Object.keys(p.metrics)).toEqual(expect.arrayContaining(TWO_CLASSES))
    TWO_CLASSES.forEach(cls => {
      expect(p.metrics[cls].count).toBeGreaterThan(0)
    })
  })

  it("works with no responses (sociogram data empty)", () => {
    expect(() =>
      generateProposals(TEN_STUDENTS, [], NO_RULES, TWO_CLASSES, 2)
    ).not.toThrow()
  })

  it("excludes students with exclude_student rule", () => {
    const rules: Rule[] = [makeRule("r1", "exclude_student", ["s1"])]
    const proposals = generateProposals(TEN_STUDENTS, NO_RESPONSES, rules, TWO_CLASSES, 1)
    const [p] = proposals
    const assigned = p.assignments.map(a => a.student_id)
    expect(assigned).not.toContain("s1")
    expect(p.assignments).toHaveLength(TEN_STUDENTS.length - 1)
  })
})

// ── Score properties ──────────────────────────────────────────────────────────

describe("proposal scores", () => {
  it("all sub-scores are in [0, 100]", () => {
    const proposals = generateProposals(TEN_STUDENTS, NO_RESPONSES, NO_RULES, TWO_CLASSES, 2, DEFAULT_WEIGHTS, DEFAULT_CONSTRAINTS)
    proposals.forEach(p => {
      expect(p.score_total).toBeGreaterThanOrEqual(0)
      expect(p.score_total).toBeLessThanOrEqual(100)
      expect(p.score_social).toBeGreaterThanOrEqual(0)
      expect(p.score_social).toBeLessThanOrEqual(100)
      expect(p.score_academic).toBeGreaterThanOrEqual(0)
      expect(p.score_academic).toBeLessThanOrEqual(100)
      expect(p.score_gender).toBeGreaterThanOrEqual(0)
      expect(p.score_gender).toBeLessThanOrEqual(100)
      expect(p.score_behavior).toBeGreaterThanOrEqual(0)
      expect(p.score_behavior).toBeLessThanOrEqual(100)
    })
  })

  it("preserving reciprocal friendships improves social score", () => {
    const students = Array.from({ length: 6 }, (_, i) =>
      makeStudent(`s${i + 1}`, { average_grade: 7 })
    )
    // s1 ↔ s2 reciprocal pair
    const responses: Response[] = [
      { id: "r1", process_id: "p1", respondent_student_id: "s1", target_student_id: "s2", relation_type: "friendship", weight: 1, created_at: new Date().toISOString() },
      { id: "r2", process_id: "p1", respondent_student_id: "s2", target_student_id: "s1", relation_type: "friendship", weight: 1, created_at: new Date().toISOString() },
    ]
    const proposals = generateProposals(students, responses, NO_RULES, ["1A", "1B"], 5)
    // At least one proposal should keep s1 and s2 together
    const hasTogetherProposal = proposals.some(p => {
      const s1cls = p.assignments.find(a => a.student_id === "s1")?.target_class
      const s2cls = p.assignments.find(a => a.student_id === "s2")?.target_class
      return s1cls === s2cls
    })
    expect(hasTogetherProposal).toBe(true)
  })
})
