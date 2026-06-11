import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/auth"
import { NextResponse } from "next/server"

// PATCH /api/admin/centers/[id]/users  — change a user's role
// Body: { user_id: string, role: string }
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await getUserProfile()
  if (!profile || profile.role !== "superadmin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { id: centerId } = await params
  const { user_id, role } = await request.json()

  const ALLOWED_ROLES = ["admin", "tutor", "orientador"]
  if (!user_id || !ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Verify user belongs to this center
  const { data: user } = await supabase
    .from("users")
    .select("id, center_id")
    .eq("id", user_id)
    .eq("center_id", centerId)
    .single()

  if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })

  const { error } = await supabase
    .from("users")
    .update({ role })
    .eq("id", user_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE /api/admin/centers/[id]/users — remove user from center
// Body: { user_id: string }
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await getUserProfile()
  if (!profile || profile.role !== "superadmin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { id: centerId } = await params
  const { user_id } = await request.json()

  if (!user_id) return NextResponse.json({ error: "user_id requerido" }, { status: 400 })

  const supabase = createServiceClient()

  const { data: user } = await supabase
    .from("users")
    .select("id, center_id, role")
    .eq("id", user_id)
    .eq("center_id", centerId)
    .single()

  if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })
  if (user.role === "superadmin") {
    return NextResponse.json({ error: "No se puede eliminar a un superadmin" }, { status: 400 })
  }

  // Delete auth user (cascades to users table via trigger)
  const { error } = await supabase.auth.admin.deleteUser(user_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
