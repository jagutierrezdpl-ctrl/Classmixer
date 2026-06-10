import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function GET() {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const supabase = createServiceClient()

  // All processes for this center
  const { data: processes, error } = await supabase
    .from("processes")
    .select("id, name, school_year, status, created_at")
    .eq("center_id", profile.center_id)
    .order("school_year", { ascending: true })
    .order("created_at", { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const processIds = (processes ?? []).map(p => p.id)

  if (processIds.length === 0) return NextResponse.json([])

  // Student counts per process
  const { data: studentCounts } = await supabase
    .from("students")
    .select("process_id")
    .in("process_id", processIds)
    .eq("active", true)

  // Response counts per process
  const { data: responseCounts } = await supabase
    .from("responses")
    .select("process_id")
    .in("process_id", processIds)

  // Token counts (total and completed) per process
  const { data: tokenCounts } = await supabase
    .from("questionnaire_tokens")
    .select("process_id, completed_at")
    .in("process_id", processIds)

  // Sociogram metrics aggregated per process
  const { data: sociogramMetrics } = await supabase
    .from("sociogram_metrics")
    .select("process_id, received_count, reciprocal_count, isolation_score")
    .in("process_id", processIds)

  // Build lookup maps
  const studentMap: Record<string, number> = {}
  ;(studentCounts ?? []).forEach(r => {
    const key = (r as { process_id: string }).process_id
    studentMap[key] = (studentMap[key] ?? 0) + 1
  })

  const responseMap: Record<string, number> = {}
  ;(responseCounts ?? []).forEach(r => {
    const key = (r as { process_id: string }).process_id
    responseMap[key] = (responseMap[key] ?? 0) + 1
  })

  const tokenMap: Record<string, { total: number; completed: number }> = {}
  ;(tokenCounts ?? []).forEach(r => {
    const row = r as { process_id: string; completed_at: string | null }
    if (!tokenMap[row.process_id]) tokenMap[row.process_id] = { total: 0, completed: 0 }
    tokenMap[row.process_id].total++
    if (row.completed_at) tokenMap[row.process_id].completed++
  })

  const metricsMap: Record<string, { isolated: number; vulnerable: number; total: number }> = {}
  ;(sociogramMetrics ?? []).forEach(r => {
    const row = r as { process_id: string; received_count: number; reciprocal_count: number; isolation_score: number }
    if (!metricsMap[row.process_id]) metricsMap[row.process_id] = { isolated: 0, vulnerable: 0, total: 0 }
    metricsMap[row.process_id].total++
    if (row.received_count === 0) metricsMap[row.process_id].isolated++
    if (row.reciprocal_count === 1 && row.received_count > 0) metricsMap[row.process_id].vulnerable++
  })

  const result = (processes ?? []).map(p => {
    const tokens = tokenMap[p.id] ?? { total: 0, completed: 0 }
    const sm = metricsMap[p.id] ?? { isolated: 0, vulnerable: 0, total: 0 }
    return {
      id: p.id,
      name: p.name,
      school_year: p.school_year,
      status: p.status,
      created_at: p.created_at,
      total_students: studentMap[p.id] ?? 0,
      total_responses: responseMap[p.id] ?? 0,
      tokens_total: tokens.total,
      tokens_completed: tokens.completed,
      response_rate: tokens.total > 0 ? Math.round((tokens.completed / tokens.total) * 100) : 0,
      sociogram_total: sm.total,
      sociogram_isolated: sm.isolated,
      sociogram_vulnerable: sm.vulnerable,
      isolated_pct: sm.total > 0 ? Math.round((sm.isolated / sm.total) * 100) : null,
      vulnerable_pct: sm.total > 0 ? Math.round((sm.vulnerable / sm.total) * 100) : null,
    }
  })

  return NextResponse.json(result)
}
