import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, hasFullAccess, tutorCanAccessProcess, logAudit } from "@/lib/auth"
import { NextResponse } from "next/server"

/** GET — returns students who chose this student (affected connections) */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; studentId: string }> },
) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id: processId, studentId } = await params
  const supabase = createServiceClient()

  // Verify ownership
  const { data: student } = await supabase
    .from("students")
    .select("id, first_name, last_name, excluded_from_mix, excluded_reason, processes!inner(center_id)")
    .eq("id", studentId)
    .eq("process_id", processId)
    .single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!student || (student as any).processes?.center_id !== profile.center_id) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  }
  if (!hasFullAccess(profile.role) && !(await tutorCanAccessProcess(profile.center_id, profile.id, processId))) {
    return NextResponse.json({ error: "Sin acceso a este proceso" }, { status: 403 })
  }

  // Find students who chose this student in any relation type
  const { data: responses } = await supabase
    .from("responses")
    .select("respondent_student_id")
    .eq("process_id", processId)
    .eq("target_student_id", studentId)

  const respondentIds = [...new Set((responses ?? []).map(r => r.respondent_student_id))]

  let affectedStudents: { id: string; first_name: string; last_name: string; current_class?: string }[] = []
  if (respondentIds.length > 0) {
    const { data } = await supabase
      .from("students")
      .select("id, first_name, last_name, current_class")
      .in("id", respondentIds)
      .eq("active", true)
    affectedStudents = data ?? []
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = student as any
  return NextResponse.json({
    student: { id: studentId, first_name: s.first_name, last_name: s.last_name },
    excluded_from_mix: s.excluded_from_mix ?? false,
    excluded_reason: s.excluded_reason ?? null,
    affected_count: affectedStudents.length,
    affected_students: affectedStudents,
  })
}

/** POST — toggle exclusion */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; studentId: string }> },
) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (!["admin", "superadmin"].includes(profile.role)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 })
  }

  const { id: processId, studentId } = await params
  const { exclude, reason }: { exclude: boolean; reason?: string } = await request.json()

  const supabase = createServiceClient()

  // Verify ownership
  const { data: student } = await supabase
    .from("students")
    .select("id, first_name, last_name, processes!inner(center_id)")
    .eq("id", studentId)
    .eq("process_id", processId)
    .single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!student || (student as any).processes?.center_id !== profile.center_id) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("students")
    .update({
      excluded_from_mix: exclude,
      excluded_reason: exclude ? (reason ?? null) : null,
    })
    .eq("id", studentId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = student as any
  await logAudit(profile.id, profile.center_id, exclude ? "exclude_student" : "include_student", "student", {
    processId,
    metadata: { studentId, name: `${s.first_name} ${s.last_name}`, reason: reason ?? null },
  })

  return NextResponse.json({ excluded_from_mix: exclude })
}
