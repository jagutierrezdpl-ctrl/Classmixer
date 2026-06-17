import type { UserRole, QuestionSensitivity } from "@/types"

// Roles that can see ALL data including very_sensitive (bullying module)
const FULL_ACCESS_ROLES: UserRole[] = ["admin", "superadmin", "orientador"]

// Roles that can see normal + sensitive data (friendship, work, emotional, negative/dificultad)
// Tutors need the full picture — including negative nominations — to understand their students'
// social dynamics and to give meaningful pedagogical guidance during the mixing process.
const SENSITIVE_VISIBLE_ROLES: UserRole[] = ["admin", "superadmin", "orientador", "tutor"]

export function canSeeSensitivity(role: UserRole, sensitivity: QuestionSensitivity): boolean {
  if (sensitivity === "normal") return true
  if (sensitivity === "very_sensitive") return FULL_ACCESS_ROLES.includes(role)
  // "sensitive" (emotional, negative/dificultad) → tutors can see
  return SENSITIVE_VISIBLE_ROLES.includes(role)
}

export function canSeeRelationType(
  role: UserRole,
  relationType: string,
  sensitivityMap: Record<string, QuestionSensitivity>
): boolean {
  // Unknown type → treat as sensitive by default (deny rather than under-filter)
  return canSeeSensitivity(role, sensitivityMap[relationType] ?? "sensitive")
}

export function filterVisibleResponses<T extends { relation_type: string }>(
  responses: T[],
  role: UserRole,
  sensitivityMap: Record<string, QuestionSensitivity>
): T[] {
  if (FULL_ACCESS_ROLES.includes(role)) return responses
  return responses.filter(r => canSeeRelationType(role, r.relation_type, sensitivityMap))
}
