import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, hasFullAccess, tutorCanAccessProcess } from "@/lib/auth"
import { NextResponse } from "next/server"

async function checkAccess(processId: string, profile: Awaited<ReturnType<typeof getUserProfile>>) {
  if (!profile) return false
  const supabase = createServiceClient()
  const { data: proc } = await supabase.from("processes").select("center_id").eq("id", processId).single()
  if (!proc || proc.center_id !== profile.center_id) return false
  if (!hasFullAccess(profile.role) && !(await tutorCanAccessProcess(profile.center_id, profile.id, processId))) return false
  return true
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const { id } = await params
  if (!(await checkAccess(id, profile))) return NextResponse.json({ error: "Sin acceso" }, { status: 403 })

  const supabase = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("sociogram_snapshots")
    .select("id, name, description, response_count, created_at, created_by")
    .eq("process_id", id)
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const { id } = await params
  if (!(await checkAccess(id, profile))) return NextResponse.json({ error: "Sin acceso" }, { status: 403 })

  const body = await req.json()
  const name = (body.name as string | undefined)?.trim()
  if (!name) return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 })

  const supabase = createServiceClient()

  // Read current responses and store as snapshot
  const { data: responses } = await supabase
    .from("responses")
    .select("respondent_student_id, target_student_id, relation_type")
    .eq("process_id", id)

  const connections = (responses ?? []).map(r => ({
    from: r.respondent_student_id,
    to: r.target_student_id,
    type: r.relation_type,
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: snapshot, error } = await (supabase as any)
    .from("sociogram_snapshots")
    .insert({
      process_id: id,
      name,
      description: body.description ?? null,
      connections,
      response_count: connections.length,
      created_by: profile.id,
    })
    .select("id, name, description, response_count, created_at")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(snapshot)
}
