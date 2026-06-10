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
