import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, hasFullAccess, tutorCanAccessProcess } from "@/lib/auth"
import { NextResponse } from "next/server"

async function checkAccess(profile: { id: string; center_id: string; role: string }, processId: string) {
  if (hasFullAccess(profile.role)) return true
  return tutorCanAccessProcess(profile.center_id, profile.id, processId)
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params

  if (!(await checkAccess(profile, id))) {
    return NextResponse.json({ error: "Sin acceso a este proceso" }, { status: 403 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from("processes")
    .select("*")
    .eq("id", id)
    .eq("center_id", profile.center_id)
    .single()

  if (error || !data) return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  return NextResponse.json(data)
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile || !["admin", "superadmin"].includes(profile.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { id } = await params
  const supabase = createServiceClient()

  const { error } = await supabase
    .from("processes")
    .delete()
    .eq("id", id)
    .eq("center_id", profile.center_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params

  if (!(await checkAccess(profile, id))) {
    return NextResponse.json({ error: "Sin acceso a este proceso" }, { status: 403 })
  }

  const body = await request.json()
  const supabase = createServiceClient()

  // Allowlist of editable fields — never spread raw body to prevent overwriting center_id, created_by, etc.
  const EDITABLE = [
    "name", "school_year", "source_level", "target_level",
    "source_groups", "target_groups", "status",
    "open_at", "close_at", "max_students_per_class", "min_students_per_class",
    "num_target_classes", "description",
  ] as const
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of EDITABLE) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (key in body) patch[key] = (body as any)[key]
  }

  const { data, error } = await supabase
    .from("processes")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(patch as any)
    .eq("id", id)
    .eq("center_id", profile.center_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
