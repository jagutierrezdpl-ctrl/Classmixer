import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, hasFullAccess, tutorCanAccessProcess, logAudit } from "@/lib/auth"
import { pushNotification } from "@/lib/notifications"
import { NextResponse } from "next/server"
import { calculateSociogram } from "@/lib/sociogram/calculate"
import { getQuestionCatalogIndex } from "@/lib/questionnaire/catalog"
import { filterVisibleResponses } from "@/lib/questionnaire/visibility"
import type { UserRole } from "@/types"

// Roles that can see emotional and negative response data
const SENSITIVE_ROLES = ["admin", "superadmin", "orientador"]

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params
  const supabase = createServiceClient()

  const { data: process } = await supabase
    .from("processes")
    .select("center_id")
    .eq("id", id)
    .single()

  if (!process || process.center_id !== profile.center_id) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  }
  if (!hasFullAccess(profile.role) && !(await tutorCanAccessProcess(profile.center_id, profile.id, id))) {
    return NextResponse.json({ error: "Sin acceso a este proceso" }, { status: 403 })
  }

  const [{ data: allStudents }, { data: allResponses }] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from("students").select("*").eq("process_id", id).eq("active", true),
    supabase.from("responses").select("*").eq("process_id", id),
  ])

  if (!allStudents) return NextResponse.json({ error: "Error al cargar alumnos" }, { status: 500 })

  // Separate excluded students so we can mark them in the graph without including in metrics
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const students = (allStudents as any[]).filter((s: any) => !s.excluded_from_mix)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const excludedStudents = (allStudents as any[]).filter((s: any) => s.excluded_from_mix)
  const excludedIds = new Set(excludedStudents.map((s: { id: string }) => s.id))

  // Tutors cannot see emotional or negative responses
  const canSeeSensitive = SENSITIVE_ROLES.includes(profile.role)
  const catalogIndex = await getQuestionCatalogIndex(profile.center_id)
  const responses = filterVisibleResponses(allResponses ?? [], profile.role as UserRole, catalogIndex.sensitivity)
    // Filter out any response involving an excluded student
    .filter((r: { respondent_student_id: string; target_student_id: string }) =>
      !excludedIds.has(r.respondent_student_id) && !excludedIds.has(r.target_student_id)
    )

  // Log sociogram access for roles that see sensitive data (orientador, tutor)
  if (profile.role === "orientador" || profile.role === "tutor") {
    await logAudit(profile.id, profile.center_id, "view_sociogram", "process", {
      processId: id,
      metadata: { role: profile.role },
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sociogram = calculateSociogram(students as any, responses as any, catalogIndex.scoringRoles.friendshipLike, catalogIndex.excludedFromGraph)

  // Fire bullying_risk notification for high-risk students (only for admin/orientador, non-blocking)
  if (canSeeSensitive) {
    const bullyingRisk = sociogram.nodes.filter(
      n => n.sociometric_status === "rechazado" && (n.rejection_received_count ?? 0) >= 5
    )
    if (bullyingRisk.length > 0) {
      pushNotification({
        centerId: profile.center_id,
        type: "bullying_risk",
        title: "Alumnos con riesgo de acoso detectados",
        message: `${bullyingRisk.length} alumno${bullyingRisk.length > 1 ? "s con" : " con"} ≥5 nominaciones de rechazo: ${bullyingRisk.map(n => `${n.first_name} ${n.last_name}`).join(", ")}.`,
        processId: id,
        entityType: "process",
        entityId: id,
      }).catch(() => {})
    }
  }

  return NextResponse.json({
    ...sociogram,
    viewer_role: profile.role,
    can_see_sensitive: canSeeSensitive,
    excluded_students: excludedStudents.map((s: { id: string; first_name: string; last_name: string; current_class?: string; excluded_reason?: string }) => ({
      id: s.id,
      first_name: s.first_name,
      last_name: s.last_name,
      current_class: s.current_class,
      excluded_reason: s.excluded_reason,
    })),
  })
}
