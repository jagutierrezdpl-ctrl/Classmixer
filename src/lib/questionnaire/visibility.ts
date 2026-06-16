import type { UserRole, QuestionSensitivity } from "@/types"

// Mismo umbral que ya aplicaba hoy de forma duplicada para "emotional"/"negative":
// tutor y alumno no ven datos sensibles, admin/superadmin/orientador sí.
const SENSITIVE_VISIBLE_ROLES: UserRole[] = ["admin", "superadmin", "orientador"]

export function canSeeSensitivity(role: UserRole, sensitivity: QuestionSensitivity): boolean {
  if (sensitivity === "normal") return true
  return SENSITIVE_VISIBLE_ROLES.includes(role)
}

export function canSeeRelationType(
  role: UserRole,
  relationType: string,
  sensitivityMap: Record<string, QuestionSensitivity>
): boolean {
  // Código desconocido en el catálogo → se trata como sensible por defecto (denegar antes que filtrar de menos).
  return canSeeSensitivity(role, sensitivityMap[relationType] ?? "sensitive")
}

export function filterVisibleResponses<T extends { relation_type: string }>(
  responses: T[],
  role: UserRole,
  sensitivityMap: Record<string, QuestionSensitivity>
): T[] {
  if (SENSITIVE_VISIBLE_ROLES.includes(role)) return responses
  return responses.filter(r => canSeeRelationType(role, r.relation_type, sensitivityMap))
}
