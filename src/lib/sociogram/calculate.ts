import type { Student, Response, SociogramData, SociogramNode, SociogramEdge, SociogramAlert, SociogramCommunity, SociometricStatus } from "@/types"

// ── Union-Find: communities from reciprocal friendship edges ──────────────────
function buildCommunities(nodeIds: string[], reciprocalEdges: { a: string; b: string }[]): Map<string, number> {
  const parent = new Map(nodeIds.map(n => [n, n]))

  function find(x: string): string {
    let root = x
    while (parent.get(root) !== root) root = parent.get(root)!
    let cur = x
    while (cur !== root) { const nxt = parent.get(cur)!; parent.set(cur, root); cur = nxt }
    return root
  }

  for (const { a, b } of reciprocalEdges) {
    const pa = find(a), pb = find(b)
    if (pa !== pb) parent.set(pa, pb)
  }

  const rootCount = new Map<string, number>()
  for (const n of nodeIds) rootCount.set(find(n), (rootCount.get(find(n)) ?? 0) + 1)
  const sorted = [...rootCount.entries()].sort((a, b) => b[1] - a[1])
  const rootToId = new Map(sorted.map(([root], i) => [root, i]))

  const result = new Map<string, number>()
  for (const n of nodeIds) result.set(n, rootToId.get(find(n)) ?? 0)
  return result
}

// ── Brandes algorithm — normalised DIRECTED betweenness centrality ────────────
// adj must be a DIRECTED adjacency (outgoing edges only).
// Normalization uses (n-1)*(n-2) for directed graphs (not /2).
// Consequence: students with in-degree=0 automatically get betweenness=0,
// since no shortest path s→v→t can pass through them.
function computeBetweenness(nodeIds: string[], adj: Map<string, Set<string>>): Map<string, number> {
  const cb = new Map<string, number>(nodeIds.map(n => [n, 0]))

  for (const s of nodeIds) {
    const stack: string[] = []
    const pred = new Map<string, string[]>(nodeIds.map(n => [n, []]))
    const sigma = new Map<string, number>(nodeIds.map(n => [n, 0]))
    const dist = new Map<string, number>(nodeIds.map(n => [n, -1]))
    sigma.set(s, 1); dist.set(s, 0)
    const queue: string[] = [s]

    while (queue.length > 0) {
      const v = queue.shift()!
      stack.push(v)
      for (const w of (adj.get(v) ?? new Set())) {
        if ((dist.get(w) ?? -1) < 0) { queue.push(w); dist.set(w, (dist.get(v) ?? 0) + 1) }
        if ((dist.get(w) ?? -1) === (dist.get(v) ?? 0) + 1) {
          sigma.set(w, (sigma.get(w) ?? 0) + (sigma.get(v) ?? 0))
          pred.get(w)!.push(v)
        }
      }
    }

    const delta = new Map<string, number>(nodeIds.map(n => [n, 0]))
    while (stack.length > 0) {
      const w = stack.pop()!
      for (const v of (pred.get(w) ?? [])) {
        const c = ((sigma.get(v) ?? 0) / Math.max(sigma.get(w) ?? 1, 1)) * (1 + (delta.get(w) ?? 0))
        delta.set(v, (delta.get(v) ?? 0) + c)
      }
      if (w !== s) cb.set(w, (cb.get(w) ?? 0) + (delta.get(w) ?? 0))
    }
  }

  const n = nodeIds.length
  // Directed normalization: (n-1)*(n-2) — twice the undirected value because
  // directed graphs have ordered pairs (s,t) and (t,s) as distinct paths.
  const norm = n > 2 ? (n - 1) * (n - 2) : 1
  for (const [k, v] of cb) cb.set(k, v / norm)
  return cb
}

// ── Statistical helpers ───────────────────────────────────────────────────────
function mean(arr: number[]): number {
  return arr.length === 0 ? 0 : arr.reduce((s, v) => s + v, 0) / arr.length
}

function stddev(arr: number[], mu: number): number {
  const variance = arr.reduce((s, v) => s + (v - mu) ** 2, 0) / Math.max(arr.length - 1, 1)
  return Math.sqrt(variance)
}

function toZScores(arr: number[]): number[] {
  const mu = mean(arr)
  const sd = stddev(arr, mu)
  if (sd === 0) return arr.map(() => 0)
  return arr.map(v => (v - mu) / sd)
}

// ── CDC classification (Coie, Dodge & Coppotelli, 1982) ───────────────────────
// Without rejection data we can still classify Popular/Ignorado/Promedio
function cdcClassify(zSP: number, zSI: number, zLM: number, zLL: number, hasRejectionData: boolean): SociometricStatus {
  if (zSP > 1.0 && zLM > 0.0 && (!hasRejectionData || zLL < 0.0)) return "popular"
  if (hasRejectionData && zSP < -1.0 && zLM < 0.0 && zLL > 0.0) return "rechazado"
  if (zSI < -1.0 && zLM < 0.0 && (!hasRejectionData || zLL < 0.0)) return "ignorado"
  if (hasRejectionData && zSI > 1.0 && zLM > 0.0 && zLL > 0.0) return "controvertido"
  if (Math.abs(zSP) <= 0.5 && Math.abs(zSI) <= 0.5) return "promedio"
  return "no_clasificado"
}

// ─────────────────────────────────────────────────────────────────────────────
export function calculateSociogram(
  students: Student[],
  rawResponses: Response[],
  friendshipLike: string[] = ["friendship"],
  excludedFromGraph: string[] = [],
  negativeLike: string[] = ["negative"]
): SociogramData {
  const responses = excludedFromGraph.length > 0
    ? rawResponses.filter(r => !excludedFromGraph.includes(r.relation_type))
    : rawResponses

  const nodeIds = students.map(s => s.id)
  const isFriendshipLike = (rt: string) => friendshipLike.includes(rt)
  const isNegativeLike   = (rt: string) => negativeLike.includes(rt)

  // ── Nomination counts ─────────────────────────────────────────────────────
  const received  = new Map<string, number>(nodeIds.map(n => [n, 0]))  // LM: positive received
  const given     = new Map<string, number>(nodeIds.map(n => [n, 0]))
  const reciprocal = new Map<string, number>(nodeIds.map(n => [n, 0]))
  const rejRecv   = new Map<string, number>(nodeIds.map(n => [n, 0]))  // LL: rejection received
  const rejGiven  = new Map<string, number>(nodeIds.map(n => [n, 0]))
  const rejRecipr = new Map<string, number>(nodeIds.map(n => [n, 0]))

  const friendshipResponses = responses.filter(r => isFriendshipLike(r.relation_type))
  const negativeResponses   = responses.filter(r => isNegativeLike(r.relation_type))

  const friendshipSet = new Set(friendshipResponses.map(r => `${r.respondent_student_id}→${r.target_student_id}`))
  const negativeSet   = new Set(negativeResponses.map(r => `${r.respondent_student_id}→${r.target_student_id}`))

  for (const r of friendshipResponses) {
    given.set(r.respondent_student_id, (given.get(r.respondent_student_id) ?? 0) + 1)
    received.set(r.target_student_id, (received.get(r.target_student_id) ?? 0) + 1)
  }
  for (const r of negativeResponses) {
    rejGiven.set(r.respondent_student_id, (rejGiven.get(r.respondent_student_id) ?? 0) + 1)
    rejRecv.set(r.target_student_id, (rejRecv.get(r.target_student_id) ?? 0) + 1)
  }

  // ── Build edges ───────────────────────────────────────────────────────────
  const edges: SociogramEdge[] = []
  const addedEdges = new Set<string>()
  for (const r of responses) {
    const isRecip = isFriendshipLike(r.relation_type) && friendshipSet.has(`${r.target_student_id}→${r.respondent_student_id}`)
    const key = [r.respondent_student_id, r.target_student_id].sort().join("—") + r.relation_type
    if (!addedEdges.has(key)) {
      addedEdges.add(key)
      edges.push({ id: r.id, source: r.respondent_student_id, target: r.target_student_id, relation_type: r.relation_type, weight: r.weight, is_reciprocal: isRecip })
    }
  }

  // Count reciprocal friendship pairs per student (Re)
  for (const e of edges) {
    if (e.is_reciprocal && isFriendshipLike(e.relation_type)) {
      reciprocal.set(e.source, (reciprocal.get(e.source) ?? 0) + 1)
      reciprocal.set(e.target, (reciprocal.get(e.target) ?? 0) + 1)
    }
  }

  // Count mutual rejection pairs (Rr) — for group dissociation index
  let mutualRejectionPairs = 0
  const countedRejPairs = new Set<string>()
  for (const r of negativeResponses) {
    if (negativeSet.has(`${r.target_student_id}→${r.respondent_student_id}`)) {
      const key = [r.respondent_student_id, r.target_student_id].sort().join("—")
      if (!countedRejPairs.has(key)) {
        countedRejPairs.add(key)
        mutualRejectionPairs++
        rejRecipr.set(r.respondent_student_id, (rejRecipr.get(r.respondent_student_id) ?? 0) + 1)
        rejRecipr.set(r.target_student_id, (rejRecipr.get(r.target_student_id) ?? 0) + 1)
      }
    }
  }

  // ── Directed adjacency (FRIENDSHIP ONLY, outgoing) — for betweenness ───────
  // Using only friendship-like edges ensures that:
  //   (a) the graph models positive social choice (not rejection or work),
  //   (b) nodes with in-degree=0 on the friendship network get betweenness=0,
  //       preventing the "isolated node classified as bridge" bug that arose
  //       when negative/work edges provided spurious incoming paths.
  const adjOut = new Map<string, Set<string>>(nodeIds.map(n => [n, new Set()]))
  for (const r of friendshipResponses) {
    adjOut.get(r.respondent_student_id)?.add(r.target_student_id)
  }

  // ── Undirected adjacency (all friendship, both directions) — for community detection
  const adjAll = new Map<string, Set<string>>(nodeIds.map(n => [n, new Set()]))
  for (const r of friendshipResponses) {
    adjAll.get(r.respondent_student_id)?.add(r.target_student_id)
    adjAll.get(r.target_student_id)?.add(r.respondent_student_id)
  }

  const betweenness = nodeIds.length > 2
    ? computeBetweenness(nodeIds, adjOut)
    : new Map(nodeIds.map(n => [n, 0]))

  // ── Communities (Union-Find on reciprocal friendship edges) ───────────────
  const reciprocalEdgePairs = edges
    .filter(e => e.is_reciprocal && isFriendshipLike(e.relation_type))
    .map(e => ({ a: e.source, b: e.target }))
  const communityMap = buildCommunities(nodeIds, reciprocalEdgePairs)

  // ── CDC Algorithm (Coie, Dodge & Coppotelli, 1982) ────────────────────────
  const N = students.length
  const hasRejectionData = negativeResponses.length > 0

  const lmArr = nodeIds.map(id => received.get(id) ?? 0)   // LM vector
  const llArr = nodeIds.map(id => rejRecv.get(id) ?? 0)    // LL vector

  const zLMArr = toZScores(lmArr)
  // When there is no rejection data, SP and SI would be identical (SP=SI=zLM),
  // making zSP=zSI and collapsing the 2D space to a diagonal. In that case we
  // can only meaningfully distinguish Popular (high zLM) and Ignorado (low zLM);
  // all other students correctly fall as Promedio. We still compute zSP/zSI so
  // cdcClassify can run normally — the thresholds simply produce fewer Rechazado
  // or Controvertido (correct: we have no rejection evidence for those labels).
  const zLLArr = hasRejectionData ? toZScores(llArr) : lmArr.map(() => 0)

  const spArr = nodeIds.map((_, i) => zLMArr[i] - zLLArr[i])  // SP = zLM - zLL
  const siArr = nodeIds.map((_, i) => zLMArr[i] + zLLArr[i])  // SI = zLM + zLL

  // When no rejection data, SP === zLM so z-scoring SP gives the same ordering
  // as zLM — that is correct. SI === zLM too, so zSI === zSP. The Popular
  // condition (zSP > 1, zLM > 0) fires for high-election students; Ignorado
  // (zSI < -1, zLM < 0) fires for low-election students; everyone else is
  // Promedio. This is the best possible 3-class degradation without rejection data.
  const zSPArr = toZScores(spArr)
  const zSIArr = hasRejectionData ? toZScores(siArr) : zSPArr.map(v => v) // avoid identical array ref

  // ── Bridge threshold (mean + 1 SD of betweenness) ────────────────────────
  // Using "mean + 1 SD" selects approximately the top 16% of nodes by
  // betweenness, which is the statistically principled criterion for a
  // "notable intermediary" role. The old "15% of max" threshold was too
  // permissive and classified ~80% of a typical class as bridges.
  const btwArr = nodeIds.map(n => betweenness.get(n) ?? 0)
  const btwMean = mean(btwArr)
  const btwSD   = stddev(btwArr, btwMean)
  const bridgeThreshold = Math.max(btwMean + btwSD, 0.0001)
  const maxDegree = Math.max(...nodeIds.map(n => (received.get(n) ?? 0) + (given.get(n) ?? 0)), 1)

  // ── Build nodes ───────────────────────────────────────────────────────────
  const nodes: SociogramNode[] = students.map((s, i) => {
    const recvCount    = received.get(s.id) ?? 0
    const givenCount   = given.get(s.id) ?? 0
    const recipCount   = reciprocal.get(s.id) ?? 0
    const rejRcvCount  = rejRecv.get(s.id) ?? 0
    const btwn         = betweenness.get(s.id) ?? 0
    const degree       = recvCount + givenCount
    const centrality   = degree / maxDegree

    const zLM = zLMArr[i]
    const zLL = zLLArr[i]
    const zSP = zSPArr[i]
    const zSI = zSIArr[i]

    const status = cdcClassify(zSP, zSI, zLM, zLL, hasRejectionData)

    // Backward-compat flags (drive mixing algorithm & UI colours)
    // is_isolated → "ignorado" (invisible) OR truly zero received
    const isIsolated = recvCount === 0
    // is_vulnerable → fragile position (low visibility, no reciprocals) OR rejected.
    // Popular/controversial students are high-impact by definition — they are not at risk
    // of passive isolation and must never appear in the vulnerable list.
    const isHighImpact = status === "popular" || status === "controvertido"
    const isVulnerable = !isIsolated && !isHighImpact && (
      status === "rechazado" ||
      (recipCount === 0 && recvCount <= 3) ||
      (recipCount === 1 && recvCount <= 2)
    )
    // is_leader → popular OR controversial (high social impact)
    const isLeader = status === "popular" || status === "controvertido" || (recvCount >= 4 && centrality >= 0.35)

    const neighborCommunities = new Set([...(adjAll.get(s.id) ?? new Set())].map(nb => communityMap.get(nb)))
    // A bridge must: (1) have positive betweenness, (2) not be isolated,
    // (3) have at least one positive friendship nomination received (in-degree > 0
    //     on the friendship graph — ensures directed betweenness is meaningful),
    // (4) exceed the mean+1SD threshold, (5) connect ≥2 distinct communities.
    const isBridge = recvCount > 0 && !isIsolated && btwn > bridgeThreshold && neighborCommunities.size >= 2

    const reciprocityRate = recvCount > 0 ? recipCount / recvCount : 0

    return {
      id: s.id,
      label: `${s.first_name} ${s.last_name}`,
      first_name: s.first_name,
      last_name: s.last_name,
      current_class: s.current_class,
      gender: s.gender,
      academic_level: s.academic_level,
      average_grade: s.average_grade,
      behavior_level: s.behavior_level,
      needs_type: s.needs_type,
      received_count: recvCount,
      given_count: givenCount,
      reciprocal_count: recipCount,
      rejection_received_count: rejRcvCount,
      centrality: Math.round(centrality * 1000) / 1000,
      betweenness: Math.round(btwn * 1000) / 1000,
      isolation_score: isIsolated ? 1 : isVulnerable ? 0.5 : 0,
      community_id: communityMap.get(s.id) ?? 0,
      sociometric_status: status,
      social_preference_z: Math.round(zSP * 100) / 100,
      social_impact_z: Math.round(zSI * 100) / 100,
      reciprocity_rate: Math.round(reciprocityRate * 100) / 100,
      is_isolated: isIsolated,
      is_vulnerable: isVulnerable,
      is_leader: isLeader,
      is_bridge: isBridge,
    }
  })

  // ── Community structures ──────────────────────────────────────────────────
  const commMembers = new Map<number, string[]>()
  for (const n of nodes) {
    const cid = n.community_id ?? 0
    if (!commMembers.has(cid)) commMembers.set(cid, [])
    commMembers.get(cid)!.push(n.id)
  }

  const communities: SociogramCommunity[] = []
  for (const [cid, memberIds] of commMembers) {
    if (memberIds.length < 2) continue
    const memberSet = new Set(memberIds)
    let externalLinks = 0
    for (const mid of memberIds)
      for (const nb of (adjAll.get(mid) ?? new Set()))
        if (!memberSet.has(nb)) externalLinks++

    communities.push({
      id: cid,
      members: memberIds,
      size: memberIds.length,
      is_closed: memberIds.length >= 3 && externalLinks < memberIds.length * 0.5,
    })
  }
  communities.sort((a, b) => b.size - a.size)

  // ── Alerts ────────────────────────────────────────────────────────────────
  const alerts: SociogramAlert[] = []
  const isolated    = nodes.filter(n => n.is_isolated)
  // Rechazados (active rejection) are separated from passive vulnerability — they need a stronger alert
  const rechazados  = nodes.filter(n => n.sociometric_status === "rechazado")
  const vulnerable  = nodes.filter(n => n.is_vulnerable && !n.is_isolated && n.sociometric_status !== "rechazado")
  const bullyingRisk = rechazados.filter(n => (n.rejection_received_count ?? 0) >= 5)
  const bridges     = nodes.filter(n => n.is_bridge)
  const closedGroups = communities.filter(c => c.is_closed && c.size >= 4)

  if (bullyingRisk.length > 0)
    alerts.push({ type: "bullying_risk", severity: "high", student_ids: bullyingRisk.map(n => n.id), message: `${bullyingRisk.length} alumno(s) con ≥5 nominaciones de rechazo — revisar protocolo de convivencia` })
  if (isolated.length > 0)
    alerts.push({ type: "isolated", severity: "high", student_ids: isolated.map(n => n.id), message: `${isolated.length} alumno(s) sin ninguna relación social detectada` })
  if (rechazados.length > 0)
    alerts.push({ type: "rechazado_activo", severity: "high", student_ids: rechazados.map(n => n.id), message: `${rechazados.length} alumno(s) con rechazo social activo (CDC rechazado) — diferente al aislamiento pasivo` })
  if (vulnerable.length > 0)
    alerts.push({ type: "vulnerable", severity: "medium", student_ids: vulnerable.map(n => n.id), message: `${vulnerable.length} alumno(s) con posición social frágil (pocos vínculos, sin rechazo activo)` })
  closedGroups.forEach(g =>
    alerts.push({ type: "closed_group", severity: "medium", student_ids: g.members, message: `Subgrupo cerrado de ${g.size} alumnos con escasas conexiones externas` })
  )
  if (bridges.length > 0)
    alerts.push({ type: "bridge", severity: "low", student_ids: bridges.map(n => n.id), message: `${bridges.length} alumno(s) puente detectado(s) — clave para la cohesión del grupo` })

  // ── Formal group indices (CIVSOC — Fernández-Ballesteros, 1995) ───────────
  const possiblePairs = N > 1 ? N * (N - 1) / 2 : 1
  const reciprocalEdges = edges.filter(e => e.is_reciprocal && isFriendshipLike(e.relation_type))

  // CG — Group Cohesion: reciprocal positive pairs / possible pairs
  const groupCohesion = reciprocalEdges.length / possiblePairs

  // DG — Group Dissociation: mutual rejection pairs / possible pairs
  const groupDissociation = mutualRejectionPairs / possiblePairs

  // CoG — Group Coherence: reciprocated nominations / total nominations given
  // (what proportion of outgoing choices find reciprocity)
  const groupCoherence = friendshipResponses.length > 0
    ? (reciprocalEdges.length * 2) / friendshipResponses.length
    : 0

  // IG — Group Intensity: total active nominations (positive + negative) per student
  const groupIntensity = N > 0
    ? (friendshipResponses.length + negativeResponses.length) / N
    : 0

  // Legacy density: friendship nominations / all possible directed pairs
  // (only friendship, not work/negative, to measure the social choice network)
  const density = N > 1 ? friendshipResponses.length / (N * (N - 1)) : 0
  // Legacy cohesion (CoG — coherence): what proportion of given choices are reciprocated
  // Note: group_cohesion (IAg) is the scientifically correct "Cohesión Grupal" metric
  const cohesion = friendshipResponses.length > 0 ? reciprocalEdges.length / friendshipResponses.length : 0

  // CDC status counts
  const statusCounts = (status: SociometricStatus) => nodes.filter(n => n.sociometric_status === status).length

  return {
    nodes,
    edges,
    alerts,
    communities,
    metrics: {
      total_students: N,
      isolated_count: isolated.length,
      vulnerable_count: vulnerable.length,
      leaders_count: nodes.filter(n => n.is_leader).length,
      bridges_count: bridges.length,
      communities_count: communities.length,
      reciprocal_pairs: reciprocalEdges.length,
      density: Math.round(density * 1000) / 1000,
      cohesion: Math.round(cohesion * 1000) / 1000,
      popular_count: statusCounts("popular"),
      rejected_count: statusCounts("rechazado"),
      neglected_count: statusCounts("ignorado"),
      controversial_count: statusCounts("controvertido"),
      average_count: statusCounts("promedio"),
      group_cohesion: Math.round(groupCohesion * 1000) / 1000,
      group_dissociation: Math.round(groupDissociation * 1000) / 1000,
      group_coherence: Math.round(groupCoherence * 1000) / 1000,
      group_intensity: Math.round(groupIntensity * 100) / 100,
      has_rejection_data: hasRejectionData,
    },
  }
}
