import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function GET() {
  const profile = await getUserProfile()
  if (!profile || profile.role !== "superadmin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const supabase = createServiceClient()

  const [
    { count: totalCenters },
    { count: totalUsers },
    { count: totalStudents },
    { count: totalProcesses },
    { count: activeProcesses },
    { count: openQuestionnaires },
    { count: pendingTokens },
    { count: approvedProposals },
  ] = await Promise.all([
    supabase.from("centers").select("id", { count: "exact", head: true }),
    supabase.from("users").select("id", { count: "exact", head: true }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from("student_profiles").select("id", { count: "exact", head: true }).eq("active", true),
    supabase.from("processes").select("id", { count: "exact", head: true }),
    supabase.from("processes").select("id", { count: "exact", head: true })
      .not("status", "in", '("cerrado","archivado","borrador")'),
    supabase.from("processes").select("id", { count: "exact", head: true })
      .eq("status", "cuestionario_abierto"),
    supabase.from("questionnaire_tokens").select("id", { count: "exact", head: true })
      .is("completed_at", null),
    supabase.from("proposals").select("id", { count: "exact", head: true })
      .eq("status", "aprobada"),
  ])

  return NextResponse.json({
    total_centers: totalCenters ?? 0,
    total_users: totalUsers ?? 0,
    total_students: totalStudents ?? 0,
    total_processes: totalProcesses ?? 0,
    active_processes: activeProcesses ?? 0,
    open_questionnaires: openQuestionnaires ?? 0,
    pending_tokens: pendingTokens ?? 0,
    approved_proposals: approvedProposals ?? 0,
  })
}
