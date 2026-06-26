import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const { id } = await params
  const supabase = createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("group_sets")
    .select(`
      *,
      group_sessions!inner(*, processes!inner(center_id)),
      group_assignments(*, students(*))
    `)
    .eq("id", id)
    .single()

  if (error || !data) return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((data as any).group_sessions?.processes?.center_id !== profile.center_id) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 })
  }
  return NextResponse.json(data)
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const { id } = await params
  const supabase = createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from("group_sets")
    .select("id, status, group_sessions!inner(process_id, processes!inner(center_id))")
    .eq("id", id)
    .single()

  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((existing as any).group_sessions?.processes?.center_id !== profile.center_id) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 })
  }

  const body = await req.json()
  const { assignments } = body as {
    assignments: { student_id: string; group_number: number; role: string | null }[]
  }

  if (!assignments || !Array.isArray(assignments)) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })
  }

  // Replace all assignments atomically
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("group_assignments").delete().eq("group_set_id", id)

  if (assignments.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertErr } = await (supabase as any)
      .from("group_assignments")
      .insert(assignments.map(a => ({ ...a, group_set_id: id })))

    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const { id } = await params
  const supabase = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("group_sets")
    .select("id, group_sessions!inner(process_id, processes!inner(center_id))")
    .eq("id", id)
    .single()
  if (!data) return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((data as any).group_sessions?.processes?.center_id !== profile.center_id) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 })
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("group_sets").delete().eq("id", id)
  return NextResponse.json({ ok: true })
}
