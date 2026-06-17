import type { AlgorithmWeights, AlgorithmProfile } from "@/types"

export const WEIGHT_PROFILES: Record<Exclude<AlgorithmProfile, "personalizado">, AlgorithmWeights> = {
  equilibrado: {
    conflicts: 100,
    avoid_isolation: 95,
    reciprocal_friendships: 90,
    chosen_friendships: 85,
    work_relations: 75,
    academic_balance: 80,
    gender_balance: 60,
    group_mix: 50,
    behavior: 70,
    special_needs: 80,
  },
  social: {
    conflicts: 100,
    avoid_isolation: 100,
    reciprocal_friendships: 100,
    chosen_friendships: 95,
    work_relations: 85,
    academic_balance: 40,
    gender_balance: 35,
    group_mix: 25,
    behavior: 55,
    special_needs: 65,
  },
  academico: {
    conflicts: 80,
    avoid_isolation: 65,
    reciprocal_friendships: 55,
    chosen_friendships: 45,
    work_relations: 70,
    academic_balance: 100,
    gender_balance: 80,
    group_mix: 60,
    behavior: 75,
    special_needs: 90,
  },
  convivencia: {
    conflicts: 100,
    avoid_isolation: 75,
    reciprocal_friendships: 65,
    chosen_friendships: 60,
    work_relations: 60,
    academic_balance: 70,
    gender_balance: 60,
    group_mix: 50,
    behavior: 100,
    special_needs: 85,
  },
}

export const DEFAULT_WEIGHTS = WEIGHT_PROFILES.equilibrado

export const WEIGHT_LABELS: Record<keyof AlgorithmWeights, string> = {
  conflicts: "Separaciones obligatorias",
  avoid_isolation: "Evitar aislamiento",
  reciprocal_friendships: "Amistades recíprocas",
  chosen_friendships: "Amistades elegidas",
  work_relations: "Relaciones de trabajo",
  academic_balance: "Equilibrio académico",
  gender_balance: "Equilibrio de género",
  group_mix: "Mezcla de grupos origen",
  behavior: "Distribución de conducta",
  special_needs: "Distribución de necesidades",
}

export const WEIGHT_TOOLTIPS: Record<keyof AlgorithmWeights, string> = {
  conflicts: "Penaliza si dos alumnos con regla 'no juntar' acaban en la misma clase. A 100, es casi una restricción dura.",
  avoid_isolation: "Recompensa que cada alumno tenga al menos un amigo elegido en su nueva clase. Especialmente importante para alumnos vulnerables.",
  reciprocal_friendships: "Recompensa preservar parejas de amistad mutua (A eligió a B y B eligió a A). Son los vínculos más fuertes.",
  chosen_friendships: "Recompensa mantener cualquier elección de amistad, aunque no sea recíproca. Más flexible que el anterior.",
  work_relations: "Recompensa que los alumnos que trabajan bien juntos compartan clase. Útil para proyectos y cooperativo.",
  academic_balance: "Penaliza diferencias de nota media entre clases. A 100, las clases tendrán notas casi idénticas.",
  gender_balance: "Penaliza desequilibrios de género entre clases. A 100, la proporción de chicos/chicas será casi igual en todas.",
  group_mix: "Penaliza que muchos alumnos de la misma clase de origen acaben juntos. Favorece la mezcla real entre grupos.",
  behavior: "Penaliza concentrar alumnos con conducta difícil o de seguimiento en una sola clase. Los reparte entre todas.",
  special_needs: "Penaliza concentrar alumnos con necesidades educativas en una sola clase. Los distribuye equitativamente.",
}
