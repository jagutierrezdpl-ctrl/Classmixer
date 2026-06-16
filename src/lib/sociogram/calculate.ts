import type { Student, Response, SociogramData, SociogramNode, SociogramEdge, SociogramAlert, SociogramCommunity } from "@/types"

// Union-Find: communities from reciprocal friendship edges
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

  // Count members per root, sort by size desc → sequential IDs
  const rootCount = new Map<string, number>()
  for (const n of nodeIds) rootCount.set(find(n), (rootCount.get(find(n)) ?? 0) + 1)
  const sorted = [...rootCount.entries()].sort((a, b) => b[1] - a[1])
  const rootToId = new Map(sorted.map(([root], i) => [root, i]))

  const result = new Map<string, number>()
  for (const n of nodeIds) result.set(n, rootToId.get(find(n)) ?? 0)
  return result
}

// Brandes algorithm — betweenness centrality on undirected graph
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
  const norm = n > 2 ? (n - 1) * (n - 2) / 2 : 1
  for (const [k, v] of cb) cb.set(k, v / norm)
  return cb
}

export function calculateSociogram(
  students: Student[],
  rawResponses: Response[],
  friendshipLike: string[] = ["friendship"],
  excludedFromGraph: string[] = []
): SociogramData {
  // Tipos como nominación de roles o convivencia/acoso se recogen para sus propios
  // informes (dashboard de respuestas, informe de convivencia) pero no deben mezclarse
  // visualmente con las relaciones del sociograma ni alterar centralidad/densidad.
  const responses = excludedFromGraph.length > 0
    ? rawResponses.filter(r => !excludedFromGraph.includes(r.relation_type))
    : rawResponses

  const nodeIds = students.map(s => s.id)
  const isFriendshipLike = (relationType: string) => friendshipLike.includes(relationType)

  const received = new Map<string, number>(nodeIds.map(n => [n, 0]))
  const given = new Map<string, number>(nodeIds.map(n => [n, 0]))
  const reciprocal = new Map<string, number>(nodeIds.map(n => [n, 0]))

  const friendshipResponses = responses.filter(r => isFriendshipLike(r.relation_type))
  const friendshipSet = new Set(friendshipResponses.map(r => `${r.respondent_student_id}→${r.target_student_id}`))

  for (const r of friendshipResponses) {
    given.set(r.respondent_student_id, (given.get(r.respondent_student_id) ?? 0) + 1)
    received.set(r.target_student_id, (received.get(r.target_student_id) ?? 0) + 1)
  }

  // Build deduplicated edges, marking reciprocal
  const edges: SociogramEdge[] = []
  const addedEdges = new Set<string>()
  for (const r of responses) {
    const isReciprocal = isFriendshipLike(r.relation_type) && friendshipSet.has(`${r.target_student_id}→${r.respondent_student_id}`)
    const key = [r.respondent_student_id, r.target_student_id].sort().join("—") + r.relation_type
    if (!addedEdges.has(key)) {
      addedEdges.add(key)
      edges.push({ id: r.id, source: r.respondent_student_id, target: r.target_student_id, relation_type: r.relation_type, weight: r.weight, is_reciprocal: isReciprocal })
    }
  }

  // Count reciprocal per student
  for (const e of edges) {
    if (e.is_reciprocal && isFriendshipLike(e.relation_type)) {
      reciprocal.set(e.source, (reciprocal.get(e.source) ?? 0) + 1)
      reciprocal.set(e.target, (reciprocal.get(e.target) ?? 0) + 1)
    }
  }

  // Undirected adjacency for betweenness (all relation types)
  const adjAll = new Map<string, Set<string>>(nodeIds.map(n => [n, new Set()]))
  for (const r of responses) {
    adjAll.get(r.respondent_student_id)?.add(r.target_student_id)
    adjAll.get(r.target_student_id)?.add(r.respondent_student_id)
  }

  const betweenness = nodeIds.length > 2
    ? computeBetweenness(nodeIds, adjAll)
    : new Map(nodeIds.map(n => [n, 0]))

  // Communities via Union-Find on reciprocal friendship edges
  const reciprocalEdgePairs = edges
    .filter(e => e.is_reciprocal && isFriendshipLike(e.relation_type))
    .map(e => ({ a: e.source, b: e.target }))
  const communityMap = buildCommunities(nodeIds, reciprocalEdgePairs)

  const maxDegree = Math.max(...nodeIds.map(n => (received.get(n) ?? 0) + (given.get(n) ?? 0)), 1)
  const maxBetweenness = Math.max(...[...betweenness.values()], 0.001)
  const bridgeThreshold = maxBetweenness * 0.15

  const nodes: SociogramNode[] = students.map(s => {
    const recvCount = received.get(s.id) ?? 0
    const givenCount = given.get(s.id) ?? 0
    const reciprocalCount = reciprocal.get(s.id) ?? 0
    const btwn = betweenness.get(s.id) ?? 0
    const degree = recvCount + givenCount
    const centrality = degree / maxDegree

    const isIsolated = recvCount === 0 && reciprocalCount === 0
    const isVulnerable = !isIsolated && reciprocalCount === 1

    // Leader: many choices received AND high centrality
    const isLeader = recvCount >= 4 && centrality >= 0.35

    // Bridge: high betweenness AND neighbors span multiple communities
    const neighborCommunities = new Set([...(adjAll.get(s.id) ?? new Set())].map(nb => communityMap.get(nb)))
    const isBridge = btwn > bridgeThreshold && neighborCommunities.size >= 2

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
      reciprocal_count: reciprocalCount,
      centrality: Math.round(centrality * 1000) / 1000,
      betweenness: Math.round(btwn * 1000) / 1000,
      isolation_score: isIsolated ? 1 : isVulnerable ? 0.5 : 0,
      community_id: communityMap.get(s.id) ?? 0,
      is_isolated: isIsolated,
      is_vulnerable: isVulnerable,
      is_leader: isLeader,
      is_bridge: isBridge,
    }
  })

  // Build community structures with closed-subgroup detection
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

  // Alerts
  const alerts: SociogramAlert[] = []
  const isolated = nodes.filter(n => n.is_isolated)
  const vulnerable = nodes.filter(n => n.is_vulnerable)
  const bridges = nodes.filter(n => n.is_bridge)
  const closedGroups = communities.filter(c => c.is_closed && c.size >= 4)

  if (isolated.length > 0)
    alerts.push({ type: "isolated", severity: "high", student_ids: isolated.map(n => n.id), message: `${isolated.length} alumno(s) sin ninguna relación social detectada` })
  if (vulnerable.length > 0)
    alerts.push({ type: "vulnerable", severity: "medium", student_ids: vulnerable.map(n => n.id), message: `${vulnerable.length} alumno(s) con una única relación recíproca (riesgo de exclusión)` })
  closedGroups.forEach(g =>
    alerts.push({ type: "closed_group", severity: "medium", student_ids: g.members, message: `Subgrupo cerrado de ${g.size} alumnos con escasas conexiones externas` })
  )
  if (bridges.length > 0)
    alerts.push({ type: "bridge", severity: "low", student_ids: bridges.map(n => n.id), message: `${bridges.length} alumno(s) puente detectado(s) — clave para la cohesión del grupo` })

  // Global metrics
  const n = students.length
  const density = n > 1 ? responses.length / (n * (n - 1)) : 0
  const reciprocalEdges = edges.filter(e => e.is_reciprocal && isFriendshipLike(e.relation_type))
  const cohesion = friendshipResponses.length > 0 ? reciprocalEdges.length / friendshipResponses.length : 0

  return {
    nodes,
    edges,
    alerts,
    communities,
    metrics: {
      total_students: n,
      isolated_count: isolated.length,
      vulnerable_count: vulnerable.length,
      leaders_count: nodes.filter(nd => nd.is_leader).length,
      bridges_count: bridges.length,
      communities_count: communities.length,
      reciprocal_pairs: reciprocalEdges.length,
      density: Math.round(density * 1000) / 1000,
      cohesion: Math.round(cohesion * 1000) / 1000,
    },
  }
}
