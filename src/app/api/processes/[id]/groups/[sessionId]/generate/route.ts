import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, hasFullAccess, tutorCanAccessProcess } from "@/lib/auth"
import { NextResponse } from "next/server"
import { generateBestGroups } from "@/lib/algorithm/groups"
import type { Student } from "@/types"

export async function POST(_req: Request, { params }: { params: Promise<{ id: string; sessionId: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const { id, sessionId } = await params
  const supabase = createServiceClient()

  const { data: proc } = await supabase.from("processes").select("center_id").eq("id", id).single()
  if (!proc || proc.center_id !== profile.center_id) return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  if (!hasFullAccess(profile.role) && !(await tutorCanAccessProcess(profile.center_id, profile.id, id))) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: session } = await (supabase as any)
    .from("group_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("process_id", id)
    .single()
  if (!session) return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 })

  // Get students for this class
  const { data: students } = await supabase
    .from("students")
    .select("*")
    .eq("process_id", id)
    .eq("active", true)
    .eq("current_class", session.class_name)

  if (!students || students.length === 0) {
    return NextResponse.json({ error: "No hay alumnos en esta clase" }, { status: 400 })
  }

  const result = generateBestGroups(students as Student[], {
    numGroups: session.num_groups,
    balanceGender: session.balance_gender,
    balanceAcademic: session.balance_academic,
    useSociogram: session.use_sociogram,
  }, 20)

  // Count existing group_sets for this session to name it
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count } = await (supabase as any)
    .from("group_sets")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId)

  const setName = `Grupos ${(count ?? 0) + 1}`

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: groupSet, error: setErr } = await (supabase as any)
    .from("group_sets")
    .insert({ session_id: sessionId, name: setName, score_total: result.score_total, status: "generado" })
    .select()
    .single()

  if (setErr || !groupSet) return NextResponse.json({ error: setErr?.message ?? "Error al guardar" }, { status: 500 })

  if (result.assignments.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("group_assignments").insert(
      result.assignments.map(a => ({ ...a, group_set_id: groupSet.id }))
    )
  }

  return NextResponse.json({ id: groupSet.id, score_total: result.score_total })
}
