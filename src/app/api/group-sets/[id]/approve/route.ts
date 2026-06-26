import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/auth"
import { NextResponse } from "next/server"

async function getSetWithAccess(id: string, centerId: string) {
  const supabase = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("group_sets")
    .select("id, status, session_id, group_sessions!inner(process_id, processes!inner(center_id))")
    .eq("id", id)
    .single()
  if (!data) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((data as any).group_sessions?.processes?.center_id !== centerId) return null
  return data
}

// POST — mark this set as approved (unapproves all others in the same session)
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const { id } = await params
  const supabase = createServiceClient()

  const set = await getSetWithAccess(id, profile.center_id)
  if (!set) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessionId = (set as any).session_id

  // Unapprove all other sets in this session, then approve this one
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("group_sets")
    .update({ status: "generado" })
    .eq("session_id", sessionId)
    .neq("id", id)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("group_sets")
    .update({ status: "aprobado" })
    .eq("id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE — unapprove (back to "generado")
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const { id } = await params
  const supabase = createServiceClient()

  const set = await getSetWithAccess(id, profile.center_id)
  if (!set) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("group_sets")
    .update({ status: "generado" })
    .eq("id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
