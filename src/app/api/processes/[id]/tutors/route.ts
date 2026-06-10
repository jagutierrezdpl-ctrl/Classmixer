import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, logAudit } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params
  const supabase = createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("process_tutors")
    .select("*, users(id, name, email, role)")
    .eq("process_id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await getUserProfile()
  if (!profile || !["admin", "superadmin"].includes(profile.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()
  const { user_id } = body

  if (!user_id) return NextResponse.json({ error: "user_id requerido" }, { status: 400 })

  const supabase = createServiceClient()

  // Verify user belongs to same center
  const { data: target } = await supabase
    .from("users")
    .select("center_id")
    .eq("id", user_id)
    .single()

  if (!target || target.center_id !== profile.center_id) {
    return NextResponse.json({ error: "Usuario no pertenece al centro" }, { status: 403 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("process_tutors")
    .insert({ process_id: id, user_id, assigned_by: profile.id })

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Usuario ya asignado" }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logAudit(profile.id, profile.center_id, "assign_tutor", "process", {
    processId: id,
    metadata: { user_id },
  })

  return NextResponse.json({ ok: true })
}
