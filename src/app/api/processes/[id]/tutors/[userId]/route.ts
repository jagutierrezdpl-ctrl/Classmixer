import { createClient } from "@/lib/supabase/server"
import { getUserProfile, logAudit } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const profile = await getUserProfile()
  if (!profile || !["admin", "superadmin"].includes(profile.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { id, userId } = await params
  const supabase = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("process_tutors")
    .delete()
    .eq("process_id", id)
    .eq("user_id", userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit(profile.id, profile.center_id, "unassign_tutor", "process", {
    processId: id,
    metadata: { user_id: userId },
  })

  return NextResponse.json({ ok: true })
}
