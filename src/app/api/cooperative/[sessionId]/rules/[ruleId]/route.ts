/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, hasFullAccess, tutorCanAccessProcess, getTutorGroups } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string; ruleId: string }> }
) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const { sessionId, ruleId } = await params
  const supabase = createServiceClient()

  // Verify the rule belongs to this session and the user has access
  const { data: rule } = await (supabase as any)
    .from("cooperative_rules")
    .select("id, session_id, group_sessions!inner(class_name, process_id, processes!inner(center_id))")
    .eq("id", ruleId)
    .eq("session_id", sessionId)
    .single()

  if (!rule || rule.group_sessions?.processes?.center_id !== profile.center_id) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  }

  if (!hasFullAccess(profile.role)) {
    const session = rule.group_sessions
    if (profile.role === "tutor") {
      const tutorClasses = await getTutorGroups(profile.center_id, profile.id)
      if (!tutorClasses.includes(session.class_name)) {
        return NextResponse.json({ error: "Sin acceso" }, { status: 403 })
      }
    } else {
      const ok = await tutorCanAccessProcess(profile.center_id, profile.id, session.process_id)
      if (!ok) return NextResponse.json({ error: "Sin acceso" }, { status: 403 })
    }
  }

  const { error } = await (supabase as any)
    .from("cooperative_rules")
    .delete()
    .eq("id", ruleId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
