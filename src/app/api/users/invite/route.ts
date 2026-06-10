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
