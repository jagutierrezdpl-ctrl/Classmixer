import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/auth"
import { NextResponse } from "next/server"

// PATCH /api/admin/centers/[id]/users
// Body: { user_id, role }          → change role
// Body: { user_id, action: "resend_invite" } → resend invitation email
// Body: { user_id, action: "reset_password" } → send password reset email
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await getUserProfile()
  if (!profile || profile.role !== "superadmin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { id: centerId } = await params
  const body = await request.json()
  const { user_id, role, action } = body

  if (!user_id) return NextResponse.json({ error: "user_id requerido" }, { status: 400 })

  const supabase = createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: userRaw } = await (supabase as any)
    .from("users")
    .select("id, email, center_id, role, name")
    .eq("id", user_id)
    .eq("center_id", centerId)
    .single() as { data: { id: string; email: string; center_id: string; role: string; name: string } | null }

  const user = userRaw
  if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })

  const userEmail: string = user.email

  // Resend invitation
  if (action === "resend_invite") {
    const origin = request.headers.get("origin") ?? "https://classmixer-lovat.vercel.app"
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.auth.admin as any).inviteUserByEmail(
      userEmail,
      { redirectTo: `${origin}/api/auth/callback?next=/set-password?invite=1` }
    )
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // Send password reset
  if (action === "reset_password") {
    const origin = request.headers.get("origin") ?? "https://classmixer-lovat.vercel.app"
    const { error } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email: userEmail,
      options: { redirectTo: `${origin}/set-password` },
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // Change role
  const ALLOWED_ROLES = ["admin", "tutor", "orientador"]
  if (!ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: "Rol inválido" }, { status: 400 })
  }

  const { error } = await supabase.from("users").update({ role }).eq("id", user_id)
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
