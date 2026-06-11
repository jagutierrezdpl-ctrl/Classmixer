import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/auth"
import { NextResponse } from "next/server"

// POST /api/processes/[id]/questionnaire/reset
// Body: { student_id?: string }   → reset one student
// Body: {}                        → reset all students in the process
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile || !["admin", "superadmin"].includes(profile.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const { id: processId } = await params
  const body = await request.json().catch(() => ({}))
  const { student_id } = body as { student_id?: string }

  const supabase = createServiceClient()

  // Verify process belongs to this center
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: proc } = await (supabase as any)
    .from("processes")
    .select("id")
    .eq("id", processId)
    .eq("center_id", profile.center_id)
    .single()

  if (!proc) return NextResponse.json({ error: "Proceso no encontrado" }, { status: 404 })

  if (student_id) {
    // Reset one student
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("responses")
      .delete()
      .eq("process_id", processId)
      .eq("respondent_student_id", student_id)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("questionnaire_tokens")
      .update({ used: false, completed_at: null })
      .eq("process_id", processId)
      .eq("student_id", student_id)

    return NextResponse.json({ reset: 1 })
  }

  // Reset all students in the process
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("responses")
    .delete()
    .eq("process_id", processId)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count } = await (supabase as any)
    .from("questionnaire_tokens")
    .update({ used: false, completed_at: null })
    .eq("process_id", processId)
    .select("*", { count: "exact", head: true })

  return NextResponse.json({ reset: count ?? 0 })
}
