/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, hasFullAccess, logAudit } from "@/lib/auth"
import { NextResponse } from "next/server"
import { calculateSociogram } from "@/lib/sociogram/calculate"
import { getQuestionCatalogIndex } from "@/lib/questionnaire/catalog"
import { filterVisibleResponses } from "@/lib/questionnaire/visibility"
import type { UserRole } from "@/types"

export interface LongitudinalPoint {
  process_id: string
  process_name: string
  school_year: string
  source_level: string | null
  current_class: string | null
  // Social metrics
  received_count: number
  given_count: number
  reciprocal_count: number
  centrality: number | null
  betweenness: number | null
  sociometric_status: string | null
  social_preference_z: number | null
  social_impact_z: number | null
  rejection_received_count: number
  is_isolated: boolean
  is_vulnerable: boolean
  // Academic
  average_grade: number | null
  behavior_level: string | null
}

// GET /api/history/student/[profileId] — longitudinal sociometric evolution per student profile
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ profileId: string }> }
) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (!hasFullAccess(profile.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 })

  const { profileId } = await params
  const supabase = createServiceClient()

  // Get all student instances linked to this profile across all processes in the center
  // student_profile_id is a custom column not in the generated Supabase types — cast needed
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawInstances } = await (supabase as any)
    .from("students")
    .select("id, process_id, current_class, average_grade, behavior_level, active")
    .eq("student_profile_id", profileId)
    .eq("active", true)

  const studentInstances = (rawInstances ?? []) as { id: string; process_id: string; current_class: string | null; average_grade: number | null; behavior_level: string | null; active: boolean }[]

  if (!studentInstances.length) {
    return NextResponse.json({ points: [], student_profile: null })
  }

  // Get processes, verify they belong to center
  const processIds: string[] = [...new Set(studentInstances.map(s => s.process_id))]
  const { data: processes } = await supabase
    .from("processes")
    .select("id, name, school_year, source_level, center_id")
    .in("id", processIds)
    .eq("center_id", profile.center_id)
    .order("school_year")

  if (!processes?.length) return NextResponse.json({ points: [], student_profile: null })

  const validProcessIds = new Set(processes.map(p => p.id))
  const validInstances = studentInstances.filter((s: { process_id: string }) => validProcessIds.has(s.process_id))

  // Get student profile info
  const { data: studentProfile } = await (supabase as any)
    .from("student_profiles")
    .select("id, first_name, last_name, email, center_id")
    .eq("id", profileId)
    .eq("center_id", profile.center_id)
    .single()

  const catalogIndex = await getQuestionCatalogIndex(profile.center_id)

  const points: LongitudinalPoint[] = []

  for (const proc of processes) {
    const instance = validInstances.find(s => s.process_id === proc.id)
    if (!instance) continue

    // Load all data for this process to run sociogram
    const [{ data: allStudents }, { data: allResponses }] = await Promise.all([
      supabase.from("students").select("*").eq("process_id", proc.id).eq("active", true),
      supabase.from("responses").select("*").eq("process_id", proc.id),
    ])

    const responses = filterVisibleResponses(
      allResponses ?? [],
      profile.role as UserRole,
      catalogIndex.sensitivity,
    )

    const soc = calculateSociogram(
      (allStudents ?? []) as any,
      responses as any,
      catalogIndex.scoringRoles.friendshipLike,
      catalogIndex.excludedFromGraph,
      catalogIndex.scoringRoles.negativeLike,
    )

    const node = soc.nodes.find(n => n.id === instance.id)

    points.push({
      process_id: proc.id,
      process_name: proc.name,
      school_year: proc.school_year,
      source_level: proc.source_level,
      current_class: instance.current_class,
      received_count: node?.received_count ?? 0,
      given_count: node?.given_count ?? 0,
      reciprocal_count: node?.reciprocal_count ?? 0,
      centrality: node?.centrality ?? null,
      betweenness: node?.betweenness ?? null,
      sociometric_status: node?.sociometric_status ?? null,
      social_preference_z: node?.social_preference_z ?? null,
      social_impact_z: node?.social_impact_z ?? null,
      rejection_received_count: node?.rejection_received_count ?? 0,
      is_isolated: node?.is_isolated ?? false,
      is_vulnerable: node?.is_vulnerable ?? false,
      average_grade: instance.average_grade,
      behavior_level: instance.behavior_level,
    })
  }

  await logAudit(profile.id, profile.center_id, "view_longitudinal_history", "student", {
    metadata: { profile_id: profileId },
  })

  return NextResponse.json({ points, student_profile: studentProfile ?? null })
}