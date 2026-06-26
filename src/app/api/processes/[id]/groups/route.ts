import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, hasFullAccess, tutorCanAccessProcess } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const { id } = await params
  const supabase = createServiceClient()
  const { data: proc } = await supabase.from("processes").select("center_id").eq("id", id).single()
  if (!proc || proc.center_id !== profile.center_id) return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  if (!hasFullAccess(profile.role) && !(await tutorCanAccessProcess(profile.center_id, profile.id, id))) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 })
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("group_sessions")
    .select("*, group_sets(id, name, status, score_total, generated_at), sociogram_snapshots(id, name)")
    .eq("process_id", id)
    .order("created_at", { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const { id } = await params
  const supabase = createServiceClient()
  const { data: proc } = await supabase.from("processes").select("center_id").eq("id", id).single()
  if (!proc || proc.center_id !== profile.center_id) return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  if (!hasFullAccess(profile.role) && !(await tutorCanAccessProcess(profile.center_id, profile.id, id))) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 })
  }
  const body = await req.json()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("group_sessions")
    .insert({
      process_id: id,
      class_name: body.class_name ?? "",
      name: body.name ?? "Nueva sesión",
      num_groups: body.num_groups ?? 4,
      balance_gender: body.balance_gender ?? true,
      balance_academic: body.balance_academic ?? true,
      use_sociogram: body.use_sociogram ?? false,
      max_per_group: body.max_per_group ?? null,
      sociogram_snapshot_id: body.sociogram_snapshot_id ?? null,
      created_by: profile.id,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
