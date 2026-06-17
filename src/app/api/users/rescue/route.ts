import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/auth"
import { NextResponse } from "next/server"

// Rescues a user stuck in "pending" state (center_id=null).
// This happens when someone logs in via Google OAuth before clicking an invite link,
// creating a new auth account that the trigger marks as pending.
export async function POST(request: Request) {
  const profile = await getUserProfile()
  if (!profile || !["admin", "superadmin"].includes(profile.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const body = await request.json()
  const { email, role } = body

  if (!email || !role) {
    return NextResponse.json({ error: "email y role son obligatorios" }, { status: 400 })
  }

  const validRoles = ["admin", "tutor", "orientador"]
  if (!validRoles.includes(role)) {
    return NextResponse.json({ error: "Rol no válido" }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Find the pending user (center_id IS NULL) first — this is the Google OAuth account
  // that needs to be rescued. There may also be an orphaned password account for the same
  // email that already has the correct center_id; we still need to rescue the Google one.
  const { data: pendingUser } = await supabase
    .from("users")
    .select("id, email, name")
    .ilike("email", email)
    .is("center_id", null)
    .maybeSingle()

  if (!pendingUser) {
    // No pending account found — check if they're already fully active (nothing to fix)
    const { data: alreadyActive } = await supabase
      .from("users")
      .select("id")
      .ilike("email", email)
      .eq("center_id", profile.center_id)
      .maybeSingle()

    if (alreadyActive) {
      return NextResponse.json({ error: "Este usuario ya está activo en el centro y no tiene ninguna cuenta pendiente. Si sigue sin poder entrar, pídele que cierre sesión y vuelva a iniciarla." }, { status: 409 })
    }

    return NextResponse.json({
      error: "No se encontró ningún usuario pendiente con ese email. Si aún no ha accedido a la app, usa 'Añadir usuario' en su lugar."
    }, { status: 404 })
  }

  const { error } = await supabase
    .from("users")
    .update({ center_id: profile.center_id, role })
    .eq("id", pendingUser.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, name: pendingUser.name ?? email })
}
