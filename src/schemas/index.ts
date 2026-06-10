import { z } from "zod"

export const createProcessSchema = z.object({
  name: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
  school_year: z.string().min(4, "Introduce el curso escolar (ej: 2025-2026)"),
  source_level: z.string().min(1, "Indica el nivel de origen"),
  target_level: z.string().min(1, "Indica el nivel destino"),
  source_groups: z.string().min(1, "Indica los grupos de origen (ej: 6A, 6B)"),
  target_groups: z.string().min(1, "Indica los grupos destino (ej: 1A, 1B)"),
  target_class_count: z.number().min(1).max(20),
  min_class_size: z.number().min(1).max(50),
  max_class_size: z.number().min(1).max(50),
  questionnaire_deadline: z.string().optional(),
})

export type CreateProcessInput = z.infer<typeof createProcessSchema>

export const questionnaireSettingsSchema = z.object({
  friendship_enabled: z.boolean(),
  friendship_min: z.number().min(0).max(10),
  friendship_max: z.number().min(1).max(10),
  work_enabled: z.boolean(),
  work_min: z.number().min(0).max(10),
  work_max: z.number().min(1).max(10),
  emotional_enabled: z.boolean(),
  emotional_min: z.number().min(0).max(10),
  emotional_max: z.number().min(1).max(10),
  negative_enabled: z.boolean(),
  negative_max: z.number().min(1).max(5),
  access_mode: z.enum(["token", "google", "open"]).optional(),
  deadline: z.string().optional(),
})

export type QuestionnaireSettingsInput = z.infer<typeof questionnaireSettingsSchema>

export const createRuleSchema = z.object({
  rule_type: z.enum([
    "must_separate",
    "should_keep_together",
    "must_keep_together",
    "keep_at_least_one",
    "max_from_group",
    "lock_student_to_class",
    "exclude_student",
    "protect_vulnerable",
  ]),
  priority: z.enum(["obligatoria", "alta", "media", "baja"]),
  description: z.string().optional(),
  target_class: z.string().optional(),
  max_count: z.number().optional(),
  student_ids: z.array(z.string()).min(1, "Selecciona al menos un alumno"),
})

export type CreateRuleInput = z.infer<typeof createRuleSchema>

export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
})

export type LoginInput = z.infer<typeof loginSchema>
