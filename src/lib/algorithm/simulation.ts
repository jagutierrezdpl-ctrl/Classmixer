import type { AssignmentResult } from "./heuristic"
import type { Response } from "@/types"

export interface ClassFutureMetrics {
  target_class: string
  total: number
  students_with_friend: number
  students_isolated: number
  reciprocal_pairs: number
  friendship_preservation_pct: number
}

export function simulateFutureSociogram(
  assignments: AssignmentResult[],
  responses: Response[]
): ClassFutureMetrics[] {
  const friendships = responses.filter(r => r.relation_type === "friendship")

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

  const totalReciprocal = reciprocalPairs.size
  const classesList = [...new Set(assignments.map(a => a.target_class))].sort()

  return classesList.map(cls => {
    const classStudents = assignments
      .filter(a => a.target_class === cls)
      .map(a => a.student_id)
    const classSet = new Set(classStudents)

    let studentsWithFriend = 0
    classStudents.forEach(sid => {
      const hasFriend = friendships
        .filter(r => r.respondent_student_id === sid)
        .some(r => classSet.has(r.target_student_id))
      if (hasFriend) studentsWithFriend++
    })

    let reciprocalInClass = 0
    reciprocalPairs.forEach(pair => {
      const [a, b] = pair.split("_")
      if (classSet.has(a) && classSet.has(b)) reciprocalInClass++
    })

    const preservationPct =
      totalReciprocal > 0 ? (reciprocalInClass / totalReciprocal) * 100 : 100

    return {
      target_class: cls,
      total: classStudents.length,
      students_with_friend: studentsWithFriend,
      students_isolated: classStudents.length - studentsWithFriend,
      reciprocal_pairs: reciprocalInClass,
      friendship_preservation_pct: Math.round(preservationPct * 10) / 10,
    }
  })
}
