import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const profile = await getUserProfile()
  if (!profile || !["admin", "superadmin"].includes(profile.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const body = await request.json()
  const { email, name, role } = body

  if (!email || !name || !role) {
    return NextResponse.json({ error: "email, name y role son obligatorios" }, { status: 400 })
  }

  const validRoles = ["admin", "tutor", "orientador"]
  if (!validRoles.includes(role)) {
    return NextResponse.json({ error: "Rol no válido" }, { status: 400 })
  }

  const supabase = createServiceClient()

  // License check: max_users
  const { getCenterLicense } = await import("@/lib/license")
  const license = await getCenterLicense(supabase, profile.center_id)
  if (license.max_users !== null) {
    const { count } = await supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("center_id", profile.center_id)
    if ((count ?? 0) >= license.max_users) {
      return NextResponse.json(
        { error: `Límite de usuarios alcanzado (${license.max_users}) en tu plan ${license.plan}. Actualiza tu licencia para añadir más usuarios.` },
        { status: 403 }
      )
    }
  }

  // Check if user already exists in this center
  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .eq("center_id", profile.center_id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: "Este email ya está registrado en el centro" }, { status: 409 })
  }

  // Check if a pending user exists (logged in via Google before clicking invite).
  // If so, rescue them directly instead of sending another invite.
  const { data: pendingUser } = await supabase
    .from("users")
    .select("id")
    .ilike("email", email)
    .is("center_id", null)
    .maybeSingle()

  if (pendingUser) {
    const { error: rescueError } = await supabase
      .from("users")
      .update({ center_id: profile.center_id, role, name })
      .eq("id", pendingUser.id)

    if (rescueError) return NextResponse.json({ error: rescueError.message }, { status: 500 })
    return NextResponse.json({ success: true, email, rescued: true })
  }

  const origin = request.headers.get("origin") ?? "https://classmixer-lovat.vercel.app"

  // Invite via Supabase admin
  const { data: invited, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${origin}/api/auth/callback?next=/set-password`,
    data: { name, center_id: profile.center_id, role },
  })

  if (inviteError) {
    return NextResponse.json({ error: inviteError.message }, { status: 500 })
  }

  // Pre-create profile so callback knows center + role
  const { error: profileError } = await supabase
    .from("users")
    .upsert({
      id: invited.user.id,
      email,
      name,
      role,
      center_id: profile.center_id,
    }, { onConflict: "id" })

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, email })
}
