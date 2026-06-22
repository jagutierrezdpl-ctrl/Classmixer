import { createServiceClient } from "@/lib/supabase/server"
import { calculateSociogram } from "@/lib/sociogram/calculate"
import { getQuestionCatalogIndex } from "@/lib/questionnaire/catalog"
import { filterVisibleResponses } from "@/lib/questionnaire/visibility"
import type { UserRole } from "@/types"

export type ProposedRule = {
  rule_type: string
  priority: "obligatoria" | "alta" | "media" | "baja"
  description: string
  student_ids: string[]
  max_count?: number
  reason_type:
    | "isolated_anchor"
    | "vulnerable_anchor"
    | "active_rejection"
    | "bullying_risk"
    | "closed_group_split"
    | "bridge_protected"
  students_info: { id: string; first_name: string; last_name: string; current_class: string | null }[]
}

export async function generateProposedRules(
  processId: string,
  centerId: string,
  userRole: UserRole,
): Promise<ProposedRule[]> {
  const supabase = createServiceClient()

  const [{ data: allStudents }, { data: allResponses }, { data: existingRules }] = await Promise.all([
    supabase.from("students").select("*").eq("process_id", processId).eq("active", true),
    supabase.from("responses").select("*").eq("process_id", processId),
    supabase
      .from("rules")
      .select("rule_type, rule_students(student_id)")
      .eq("process_id", processId)
      .eq("active", true),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const students = ((allStudents ?? []) as any[]).filter(s => !s.excluded_from_mix)
  const catalogIndex = await getQuestionCatalogIndex(centerId)
  const responses = filterVisibleResponses(
    allResponses ?? [],
    userRole,
    catalogIndex.sensitivity,
  )

  const soc = calculateSociogram(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    students as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    responses as any,
    catalogIndex.scoringRoles.friendshipLike,
    catalogIndex.excludedFromGraph,
    catalogIndex.scoringRoles.negativeLike,
  )

  const nodeMap = new Map(soc.nodes.map(n => [n.id, n]))

  // Build a set of existing rule pairs to avoid duplicate proposals
  // Key: "rule_type::sortedStudentIds"
  const existingPairs = new Set<string>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const rule of (existingRules ?? []) as any[]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ids = (rule.rule_students ?? []).map((rs: any) => rs.student_id).sort().join(",")
    existingPairs.add(`${rule.rule_type}::${ids}`)
  }

  function isDuplicate(ruleType: string, studentIds: string[]): boolean {
    const key = `${ruleType}::${[...studentIds].sort().join(",")}`
    return existingPairs.has(key)
  }

  function nodeInfo(id: string) {
    const n = nodeMap.get(id)
    if (!n) return null
    return { id: n.id, first_name: n.first_name ?? "", last_name: n.last_name ?? "", current_class: n.current_class ?? null }
  }

  const proposals: ProposedRule[] = []

  // ── 1. ISOLATED students ───────────────────────────────────────────────────
  for (const n of soc.nodes.filter(n => n.is_isolated)) {
    // Find their best outgoing friendship edge
    const outgoing = soc.edges.filter(e => e.source === n.id && e.relation_type === "friendship")
    const incoming = soc.edges.filter(e => e.target === n.id && e.relation_type === "friendship")

    if (outgoing.length > 0) {
      const target = outgoing[0]
      const ids = [n.id, target.target]
      if (!isDuplicate("should_keep_together", ids)) {
        const tInfo = nodeInfo(target.target)
        proposals.push({
          rule_type: "should_keep_together",
          priority: "alta",
          description: `${n.first_name} ${n.last_name} no ha recibido ninguna elección. Eligió a ${tInfo?.first_name ?? "?"} — asignarlos juntos para garantizar un vínculo.`,
          student_ids: ids,
          reason_type: "isolated_anchor",
          students_info: [nodeInfo(n.id), tInfo].filter((x): x is NonNullable<typeof x> => !!x),
        })
      }
    } else if (incoming.length > 0) {
      const source = incoming[0]
      const ids = [n.id, source.source]
      if (!isDuplicate("should_keep_together", ids)) {
        const sInfo = nodeInfo(source.source)
        proposals.push({
          rule_type: "should_keep_together",
          priority: "alta",
          description: `${n.first_name} ${n.last_name} no ha respondido el cuestionario, pero ${sInfo?.first_name ?? "?"} le eligió. Asignarlos juntos para evitar el aislamiento.`,
          student_ids: ids,
          reason_type: "isolated_anchor",
          students_info: [nodeInfo(n.id), sInfo].filter((x): x is NonNullable<typeof x> => !!x),
        })
      }
    } else {
      // Truly disconnected — protect_vulnerable
      const ids = [n.id]
      if (!isDuplicate("protect_vulnerable", ids)) {
        proposals.push({
          rule_type: "protect_vulnerable",
          priority: "alta",
          description: `${n.first_name} ${n.last_name} no tiene ninguna conexión social. Garantizar al menos un vínculo positivo en la clase nueva.`,
          student_ids: ids,
          reason_type: "isolated_anchor",
          students_info: [nodeInfo(n.id)].filter((x): x is NonNullable<typeof x> => !!x),
        })
      }
    }
  }

  // ── 2. VULNERABLE (non-rejected, non-isolated) ────────────────────────────
  const vulnerable = soc.nodes.filter(
    n => n.is_vulnerable && !n.is_isolated && n.sociometric_status !== "rechazado",
  )
  for (const n of vulnerable) {
    const reciprocals = soc.edges.filter(
      e => e.source === n.id && e.is_reciprocal && e.relation_type === "friendship",
    )
    if (reciprocals.length > 0) {
      // Keep with reciprocal partner(s)
      for (const edge of reciprocals.slice(0, 2)) {
        const ids = [n.id, edge.target]
        if (!isDuplicate("should_keep_together", ids)) {
          const tInfo = nodeInfo(edge.target)
          proposals.push({
            rule_type: "should_keep_together",
            priority: "alta",
            description: `${n.first_name} ${n.last_name} solo tiene ${n.reciprocal_count} relación/es recíproca/s. No separar de ${tInfo?.first_name ?? "?"} (único ancla afectiva).`,
            student_ids: ids,
            reason_type: "vulnerable_anchor",
            students_info: [nodeInfo(n.id), tInfo].filter((x): x is NonNullable<typeof x> => !!x),
          })
        }
      }
    } else {
      // No reciprocals — assign with best outgoing choice
      const outgoing = soc.edges
        .filter(e => e.source === n.id && e.relation_type === "friendship")
        .slice(0, 2)
      for (const edge of outgoing) {
        const ids = [n.id, edge.target]
        if (!isDuplicate("should_keep_together", ids)) {
          const tInfo = nodeInfo(edge.target)
          proposals.push({
            rule_type: "should_keep_together",
            priority: "media",
            description: `${n.first_name} ${n.last_name} no tiene reciprocidades (${n.received_count} elec. recibidas). Asignar con ${tInfo?.first_name ?? "?"} (su elección positiva).`,
            student_ids: ids,
            reason_type: "vulnerable_anchor",
            students_info: [nodeInfo(n.id), tInfo].filter((x): x is NonNullable<typeof x> => !!x),
          })
        }
      }
    }
  }

  // ── 3. CDC RECHAZADOS → must_separate from top rejectors ──────────────────
  if (soc.metrics.has_rejection_data) {
    const rejected = soc.nodes
      .filter(n => n.sociometric_status === "rechazado")
      .sort((a, b) => (b.rejection_received_count ?? 0) - (a.rejection_received_count ?? 0))

    for (const n of rejected) {
      const rej = n.rejection_received_count ?? 0
      const isBullyingRisk = rej >= 5

      // Protect_vulnerable first — don't use as distributor
      if (n.is_bridge) {
        const ids = [n.id]
        if (!isDuplicate("protect_vulnerable", ids)) {
          proposals.push({
            rule_type: "protect_vulnerable",
            priority: "obligatoria",
            description: `${n.first_name} ${n.last_name} es puente Y rechazado. Su rol de conector NO debe usarse para distribuirlo. Prioridad: protección psicosocial.`,
            student_ids: ids,
            reason_type: "bridge_protected",
            students_info: [nodeInfo(n.id)].filter((x): x is NonNullable<typeof x> => !!x),
          })
        }
      }

      // must_separate from each rejector (max 3 pairs per rejected student)
      const rejectorEdges = soc.edges
        .filter(e => e.target === n.id && e.relation_type === "negative")
        .slice(0, 3)

      for (const edge of rejectorEdges) {
        const ids = [n.id, edge.source]
        if (!isDuplicate("must_separate", ids)) {
          const rInfo = nodeInfo(edge.source)
          proposals.push({
            rule_type: "must_separate",
            priority: isBullyingRisk ? "obligatoria" : "alta",
            description: `${n.first_name} ${n.last_name} (${rej} rechazos, CDC rechazado) — no asignar con ${rInfo?.first_name ?? "?"} ${rInfo?.last_name ?? ""} (nominó rechazo explícito).`,
            student_ids: ids,
            reason_type: isBullyingRisk ? "bullying_risk" : "active_rejection",
            students_info: [nodeInfo(n.id), rInfo].filter((x): x is NonNullable<typeof x> => !!x),
          })
        }
      }

      // Also ensure rejected student stays with their positive bonds
      const reciprocals = soc.edges.filter(
        e => e.source === n.id && e.is_reciprocal && e.relation_type === "friendship",
      )
      for (const edge of reciprocals.slice(0, 1)) {
        const ids = [n.id, edge.target]
        if (!isDuplicate("should_keep_together", ids)) {
          const tInfo = nodeInfo(edge.target)
          proposals.push({
            rule_type: "should_keep_together",
            priority: "alta",
            description: `${n.first_name} ${n.last_name} es rechazado pero tiene reciprocidad con ${tInfo?.first_name ?? "?"}. Mantener este vínculo positivo en la clase nueva.`,
            student_ids: ids,
            reason_type: "active_rejection",
            students_info: [nodeInfo(n.id), tInfo].filter((x): x is NonNullable<typeof x> => !!x),
          })
        }
      }
    }
  }

  // ── 4. CLOSED SUBGROUPS → max_from_group ──────────────────────────────────
  for (const community of soc.communities.filter(c => c.is_closed && c.size >= 4)) {
    const ids = community.members
    const maxCount = Math.ceil(community.size / 2)
    if (!isDuplicate("max_from_group", ids)) {
      const names = ids
        .slice(0, 4)
        .map(mid => nodeMap.get(mid))
        .filter(Boolean)
        .map(n => n!.first_name)
        .join(", ")
      proposals.push({
        rule_type: "max_from_group",
        priority: "media",
        description: `Subgrupo cerrado de ${community.size} miembros (${names}${community.size > 4 ? "…" : ""}). Máximo ${maxCount} en la misma clase nueva para romper la endogamia del grupo.`,
        student_ids: ids,
        max_count: maxCount,
        reason_type: "closed_group_split",
        students_info: ids
          .map(nodeInfo)
          .filter((x): x is NonNullable<typeof x> => !!x),
      })
    }
  }

  return proposals
}
