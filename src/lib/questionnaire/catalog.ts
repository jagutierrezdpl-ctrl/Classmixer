import { createServiceClient } from "@/lib/supabase/server"
import type { QuestionScoringRole, QuestionSensitivity } from "@/types"

// Los 4 tipos que ya existían antes del catálogo. Siguen gestionándose desde
// questionnaire_settings (no desde questionnaire_questions), así que cualquier
// lectura de "preguntas avanzadas" debe excluirlos explícitamente para no
// duplicar la pregunta en la UI del alumno ni en el panel de admin.
export const LEGACY_QUESTION_CODES = ["friendship", "work", "emotional", "negative"] as const

export interface ScoringRoleMap {
  friendshipLike: string[]
  workLike: string[]
  negativeLike: string[]
}

export interface QuestionCatalogIndex {
  scoringRoles: ScoringRoleMap
  sensitivity: Record<string, QuestionSensitivity>
}

// Reproduce el comportamiento de hoy si el catálogo no está disponible por
// cualquier motivo (lectura fallida, tabla vacía): los 4 tipos legacy con
// exactamente el mismo scoring_role/sensitivity que tenían antes del catálogo.
const DEFAULT_CATALOG_INDEX: QuestionCatalogIndex = {
  scoringRoles: {
    friendshipLike: ["friendship"],
    workLike: ["work"],
    negativeLike: ["negative"],
  },
  sensitivity: {
    friendship: "normal",
    work: "normal",
    emotional: "sensitive",
    negative: "sensitive",
  },
}

export interface QuestionDisplayInfo {
  label: string
  color: string
  icon?: string | null
  category: string
}

// Solo para tipos de pregunta que no estén ya cubiertos por las constantes
// hardcodeadas de cada pantalla (las 4 legacy siguen resolviéndose ahí para
// no cambiar ni un píxel). Si la lectura falla, devuelve {} y cada call site
// cae a su fallback existente (mostrar el code en crudo), sin romper nada.
export async function getQuestionDisplayMap(centerId?: string): Promise<Record<string, QuestionDisplayInfo>> {
  const supabase = createServiceClient()
  const query = supabase.from("question_types").select("code, label, color, icon, category").eq("active", true)
  const { data, error } = centerId
    ? await query.or(`center_id.is.null,center_id.eq.${centerId}`)
    : await query.is("center_id", null)

  if (error || !data) return {}

  const map: Record<string, QuestionDisplayInfo> = {}
  for (const row of data as { code: string; label: string; color: string | null; icon: string | null; category: string }[]) {
    map[row.code] = { label: row.label, color: row.color ?? "#94a3b8", icon: row.icon, category: row.category }
  }
  return map
}

export async function getQuestionCatalogIndex(centerId?: string): Promise<QuestionCatalogIndex> {
  const supabase = createServiceClient()
  const query = supabase.from("question_types").select("code, scoring_role, sensitivity").eq("active", true)
  const { data, error } = centerId
    ? await query.or(`center_id.is.null,center_id.eq.${centerId}`)
    : await query.is("center_id", null)

  if (error || !data || data.length === 0) return DEFAULT_CATALOG_INDEX

  const scoringRoles: ScoringRoleMap = { friendshipLike: [], workLike: [], negativeLike: [] }
  const sensitivity: Record<string, QuestionSensitivity> = {}

  for (const row of data as { code: string; scoring_role: QuestionScoringRole; sensitivity: QuestionSensitivity }[]) {
    sensitivity[row.code] = row.sensitivity
    if (row.scoring_role === "friendship_like") scoringRoles.friendshipLike.push(row.code)
    else if (row.scoring_role === "work_like") scoringRoles.workLike.push(row.code)
    else if (row.scoring_role === "negative_like") scoringRoles.negativeLike.push(row.code)
  }

  return { scoringRoles, sensitivity }
}
