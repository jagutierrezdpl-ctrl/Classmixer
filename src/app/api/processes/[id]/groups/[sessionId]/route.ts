import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, hasFullAccess, tutorCanAccessProcess } from "@/lib/auth"
import { NextResponse } from "next/server"

async function checkAccess(processId: string, sessionId: string, profile: Awaited<ReturnType<typeof getUserProfile>>) {
  if (!profile) return null
  const supabase = createServiceClient()
  const { data: proc } = await supabase.from("processes").select("center_id").eq("id", processId).single()
  if (!proc || proc.center_id !== profile.center_id) return null
  if (!hasFullAccess(profile.role) && !(await tutorCanAccessProcess(profile.center_id, profile.id, processId))) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: session } = await (supabase as any)
    .from("group_sessions").select("id").eq("id", sessionId).eq("process_id", processId).single()
  return session ? supabase : null
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; sessionId: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const { id, sessionId } = await params
  const supabase = await checkAccess(id, sessionId, profile)
  if (!supabase) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  const body = await req.json()
  const allowed = ["name", "num_groups", "balance_gender", "balance_academic", "use_sociogram", "sociogram_snapshot_id", "max_per_group", "group_sizes"]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update: Record<string, any> = {}
  for (const key of allowed) {
    if (key in body) update[key] = body[key]
  }
  if (Object.keys(update).length === 0) return NextResponse.json({ error: "Sin cambios" }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("group_sessions").update(update).eq("id", sessionId).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; sessionId: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const { id, sessionId } = await params
  const supabase = await checkAccess(id, sessionId, profile)
  if (!supabase) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("group_sessions").delete().eq("id", sessionId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
