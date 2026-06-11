import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const profile = await getUserProfile()
  if (!profile || !["admin", "superadmin"].includes(profile.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const body = await request.json()
  const { email, name, role, password } = body

  if (!email || !name || !role || !password) {
    return NextResponse.json({ error: "Todos los campos son obligatorios" }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres" }, { status: 400 })
  }

  const validRoles = ["admin", "tutor", "orientador"]
  if (!validRoles.includes(role)) {
    return NextResponse.json({ error: "Rol no válido" }, { status: 400 })
  }

  const supabase = createServiceClient()

  // License check
  const { getCenterLicense } = await import("@/lib/license")
  const license = await getCenterLicense(supabase, profile.center_id)
  if (license.max_users !== null) {
    const { count } = await supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("center_id", profile.center_id)
    if ((count ?? 0) >= license.max_users) {
      return NextResponse.json(
        { error: `Límite de usuarios alcanzado (${license.max_users}) en tu plan ${license.plan}.` },
        { status: 403 }
      )
    }
  }

  // Duplicate check
  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .eq("center_id", profile.center_id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: "Este email ya está registrado en el centro" }, { status: 409 })
  }

  // Create auth user with password (email already confirmed)
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, center_id: profile.center_id, role, must_change_password: true },
  })

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 500 })
  }

  // Create profile row
  const { error: profileError } = await supabase.from("users").upsert({
    id: created.user.id,
    email,
    name,
    role,
    center_id: profile.center_id,
  }, { onConflict: "id" })

  if (profileError) {
    await supabase.auth.admin.deleteUser(created.user.id)
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
