import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/auth"
import { NextResponse } from "next/server"

// GET /api/student-profiles/[id] — full trajectory for a student profile
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params
  const supabase = createServiceClient()

  // Verify profile belongs to center
  const { data: studentProfile, error } = await supabase
    .from("student_profiles")
    .select("*")
    .eq("id", id)
    .eq("center_id", profile.center_id)
    .single()

  if (error || !studentProfile) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  // Get all students linked to this profile (across processes)
  // Cast as any because student_profile_id and process.process_type are new columns not yet in generated types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: studentsRaw } = await (supabase as any)
    .from("students")
    .select("*, processes(id, name, school_year, process_type, status, source_level, target_level)")
    .eq("student_profile_id", id)
    .order("created_at")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const students = studentsRaw as any[] | null

  // Get sociogram metrics for each student
  const studentIds = (students ?? []).map(s => s.id)
  const { data: sociogramMetrics } = studentIds.length > 0
    ? await supabase
        .from("sociogram_metrics")
        .select("*")
        .in("student_id", studentIds)
    : { data: [] }

  // Get proposal assignments for each student
  const { data: assignments } = studentIds.length > 0
    ? await supabase
        .from("proposal_assignments")
        .select("student_id, target_class, proposals!inner(status, name, process_id)")
        .in("student_id", studentIds)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .eq("proposals.status" as any, "aprobada")
    : { data: [] }

  const metricsMap = new Map((sociogramMetrics ?? []).map(m => [m.student_id, m]))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const assignmentsMap = new Map((assignments ?? []).map((a: any) => [a.student_id, a]))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const trajectory = (students ?? []).map((s: any) => ({
    student: s,
    process: s.processes,
    sociogram: metricsMap.get(s.id) ?? null,
    final_assignment: assignmentsMap.get(s.id) ?? null,
  }))

  return NextResponse.json({ profile: studentProfile, trajectory })
}
