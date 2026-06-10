// ─── Enums ────────────────────────────────────────────────────────────────────

export type UserRole = "superadmin" | "admin" | "tutor" | "orientador" | "alumno"

export type ProcessStatus =
  | "borrador"
  | "cuestionario_abierto"
  | "cuestionario_cerrado"
  | "en_analisis"
  | "propuestas_generadas"
  | "propuesta_seleccionada"
  | "cerrado"
  | "archivado"

export type Gender = "F" | "M" | "Otro" | "No especificado"

export type AcademicLevel = "Alto" | "Medio-alto" | "Medio" | "Medio-bajo" | "Bajo"

export type BehaviorLevel = "Positiva" | "Normal" | "Seguimiento" | "Conflictiva"

export type NeedsType = "No" | "Sí" | "ACNEAE" | "NEE" | "Refuerzo" | "Altas capacidades" | "Observación interna"

export type RelationType = "friendship" | "work" | "emotional" | "negative"

export type RuleType =
  | "must_separate"
  | "should_keep_together"
  | "must_keep_together"
  | "keep_at_least_one"
  | "max_from_group"
  | "lock_student_to_class"
  | "exclude_student"
  | "protect_vulnerable"
  | "avoid_tutor"

export type RulePriority = "obligatoria" | "alta" | "media" | "baja"

export type QuestionnaireAccessMode = "token" | "google" | "open"

export type ProposalStatus = "generada" | "editada" | "aprobada" | "descartada"

// ─── Domain Models ────────────────────────────────────────────────────────────

export interface Center {
  id: string
  name: string
  address?: string
  city?: string
  country?: string
  created_at: string
}

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  center_id: string
  created_at: string
  updated_at: string
}

export interface Process {
  id: string
  center_id: string
  name: string
  school_year: string
  source_level: string
  target_level: string
  source_groups: string[]
  target_groups: string[]
  target_class_count: number
  min_class_size: number
  max_class_size: number
  status: ProcessStatus
  questionnaire_deadline?: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface Student {
  id: string
  process_id: string
  external_id: string
  first_name: string
  last_name: string
  current_class: string
  gender: Gender
  average_grade: number
  academic_level?: AcademicLevel
  behavior_level?: BehaviorLevel
  needs_type?: NeedsType
  observations?: string
  tutor?: string
  is_repeating?: boolean
  support_type?: string
  active: boolean
  created_at: string
}

export interface StudentWithMetrics extends Student {
  received_count?: number
  given_count?: number
  reciprocal_count?: number
  centrality?: number
  betweenness?: number
  isolation_score?: number
  community_id?: number
}

export interface QuestionnaireSettings {
  id: string
  process_id: string
  friendship_enabled: boolean
  friendship_min: number
  friendship_max: number
  work_enabled: boolean
  work_min: number
  work_max: number
  emotional_enabled: boolean
  emotional_min: number
  emotional_max: number
  negative_enabled: boolean
  negative_max: number
  access_mode: QuestionnaireAccessMode
  deadline?: string
}

export interface QuestionnaireToken {
  id: string
  process_id: string
  student_id: string
  token: string
  used: boolean
  completed_at?: string
  student?: Student
}

export interface Response {
  id: string
  process_id: string
  respondent_student_id: string
  target_student_id: string
  relation_type: RelationType
  weight: number
  created_at: string
}

export interface Rule {
  id: string
  process_id: string
  rule_type: RuleType
  priority: RulePriority
  description?: string
  target_class?: string
  max_count?: number
  created_by: string
  active: boolean
  created_at: string
  students?: RuleStudent[]
}

export interface RuleStudent {
  id: string
  rule_id: string
  student_id: string
  role?: string
  student?: Student
}

export interface Proposal {
  id: string
  process_id: string
  name: string
  score_total: number
  score_social: number
  score_academic: number
  score_gender: number
  score_behavior: number
  status: ProposalStatus
  generated_at: string
  created_by?: string
  assignments?: ProposalAssignment[]
  metrics?: ProposalMetric[]
}

export interface ProposalAssignment {
  id: string
  proposal_id: string
  student_id: string
  target_class: string
  locked: boolean
  student?: Student
}

export interface ProposalMetric {
  id: string
  proposal_id: string
  metric_key: string
  metric_value: number
  target_class?: string
}

export interface SociogramMetric {
  id: string
  process_id: string
  student_id: string
  received_count: number
  given_count: number
  reciprocal_count: number
  centrality: number
  betweenness: number
  isolation_score: number
  community_id?: number
  created_at: string
}

export interface AuditLog {
  id: string
  user_id: string
  center_id: string
  process_id?: string
  action: string
  entity_type: string
  entity_id?: string
  created_at: string
  metadata?: Record<string, unknown>
}

// ─── Sociogram types ──────────────────────────────────────────────────────────

export interface SociogramNode {
  id: string
  label: string
  first_name: string
  last_name: string
  current_class: string
  gender: Gender
  academic_level?: AcademicLevel
  average_grade: number
  behavior_level?: BehaviorLevel
  needs_type?: NeedsType
  received_count: number
  given_count: number
  reciprocal_count: number
  centrality: number
  betweenness: number
  isolation_score: number
  community_id?: number
  is_isolated: boolean
  is_vulnerable: boolean
  is_leader: boolean
  is_bridge: boolean
}

export interface SociogramCommunity {
  id: number
  members: string[]
  size: number
  is_closed?: boolean
}

export interface SociogramEdge {
  id: string
  source: string
  target: string
  relation_type: RelationType
  weight: number
  is_reciprocal: boolean
}

export interface SociogramAlert {
  type: "isolated" | "vulnerable" | "conflict" | "closed_group" | "dominant_group" | "bridge"
  severity: "high" | "medium" | "low"
  student_ids: string[]
  message: string
}

export interface SociogramData {
  nodes: SociogramNode[]
  edges: SociogramEdge[]
  alerts: SociogramAlert[]
  communities: SociogramCommunity[]
  metrics: {
    total_students: number
    isolated_count: number
    vulnerable_count: number
    leaders_count: number
    bridges_count: number
    communities_count: number
    reciprocal_pairs: number
    density: number
    cohesion: number
  }
}

// ─── Algorithm types ──────────────────────────────────────────────────────────

export type AlgorithmProfile = "equilibrado" | "social" | "academico" | "convivencia" | "personalizado"

export interface AlgorithmWeights {
  conflicts: number
  avoid_isolation: number
  reciprocal_friendships: number
  chosen_friendships: number
  work_relations: number
  academic_balance: number
  gender_balance: number
  group_mix: number
  behavior: number
  special_needs: number
}

export interface AlgorithmConfig {
  profile: AlgorithmProfile
  weights: AlgorithmWeights
  num_proposals: number
  min_class_size: number
  max_class_size: number
}

// ─── Import types ─────────────────────────────────────────────────────────────

export interface ImportPreview {
  total: number
  valid: number
  errors: ImportError[]
  warnings: ImportWarning[]
  detected_classes: string[]
  gender_distribution: Record<string, number>
  average_grade: number
  level_distribution: Record<string, number>
  rows: ImportRow[]
}

export interface ImportRow {
  row_number: number
  external_id: string
  first_name: string
  last_name: string
  current_class: string
  gender: string
  average_grade: number
  academic_level?: string
  behavior_level?: string
  needs_type?: string
  observations?: string
  tutor?: string
  status: "valid" | "error" | "warning"
  issues: string[]
}

export interface ImportError {
  row: number
  field: string
  message: string
}

export interface ImportWarning {
  row: number
  field: string
  message: string
}
