import { createServiceClient } from "@/lib/supabase/server"
import { verifyPlatformToken } from "@/lib/eduplataforma/token"
import { getOrCreateAuthUserId, syncCenter } from "@/lib/eduplataforma/sync"
import { NextResponse } from "next/server"

const SYNC_COOLDOWN_MS = 15 * 60 * 1000

function mapStaffRole(role: string, secondaryRoles: string[]): "admin" | "orientador" | "tutor" | null {
  const roles = [role, ...secondaryRoles]
  if (roles.includes("admin") || roles.includes("director_general")) return "admin"
  if (roles.includes("orientador")) return "orientador"
  if (roles.includes("tutor")) return "tutor"
  return null
}

// GET /auth/from-platform?token=<PlatformToken JWT firmado por EduPlataforma>
// Receptor del SSO handoff iniciado en apps/hub/src/app/api/auth/link?module=classmixer.
// La ruta (sin /api) la fija el hub: target = new URL('/auth/from-platform', mod.base_url).
export async function GET(request: Request) {
  const { origin, searchParams } = new URL(request.url)
  const token = searchParams.get("token")

  if (!token) {
    return NextResponse.redirect(`${origin}/login?error=missing_token`)
  }

  let payload
  try {
    payload = verifyPlatformToken(token)
  } catch {
    return NextResponse.redirect(`${origin}/login?error=invalid_token`)
  }

  const role = mapStaffRole(payload.role, payload.secondary_roles ?? [])
  if (!role) {
    return NextResponse.redirect(`${origin}/login?error=no_access`)
  }

  const supabase = createServiceClient()

  // 1. Buscar o crear el centro de ClassMixer vinculado a este centro de EduPlataforma.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingCenter } = await (supabase as any)
    .from("centers")
    .select("id, last_synced_at")
    .eq("eduplataforma_center_id", payload.eduplataforma_center_id)
    .maybeSingle()

  let centerId = existingCenter?.id as string | undefined
  let lastSyncedAt = existingCenter?.last_synced_at as string | null | undefined

  if (!centerId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: created, error: createError } = await (supabase as any)
      .from("centers")
      .insert({
        name: payload.eduplataforma_center_name ?? "Centro sin nombre",
        eduplataforma_center_id: payload.eduplataforma_center_id,
      })
      .select("id")
      .single()

    if (createError || !created) {
      return NextResponse.redirect(`${origin}/login?error=center_provision_failed`)
    }
    centerId = created.id
    lastSyncedAt = null
  }

  if (!centerId) {
    return NextResponse.redirect(`${origin}/login?error=center_provision_failed`)
  }

  // 2. Alta/actualización del usuario que está entrando.
  const authId = await getOrCreateAuthUserId(payload.email, payload.name ?? payload.email)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: upsertError } = await (supabase as any)
    .from("users")
    .upsert(
      {
        id: authId,
        email: payload.email,
        name: payload.name ?? payload.email,
        role,
        center_id: centerId,
        eduplataforma_user_id: payload.eduplataforma_user_id,
      },
      { onConflict: "id" }
    )

  if (upsertError) {
    return NextResponse.redirect(`${origin}/login?error=profile_provision_failed`)
  }

  // 3. Sincronizar personal/alumnado/grupos si no se ha hecho recientemente.
  const needsSync = !lastSyncedAt || Date.now() - new Date(lastSyncedAt).getTime() > SYNC_COOLDOWN_MS
  if (needsSync) {
    try {
      await syncCenter(centerId)
    } catch (err) {
      console.error("[from-platform] sync error:", err instanceof Error ? err.message : err)
    }
  }

  // 4. Generar un magic link y reutilizar el verificador de OTP ya existente en
  // /api/auth/callback (mismo manejo de cookies/sesión que el resto de la app).
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email: payload.email,
  })

  if (linkError || !linkData?.properties?.hashed_token) {
    return NextResponse.redirect(`${origin}/login?error=session_failed`)
  }

  const callbackUrl = new URL("/api/auth/callback", origin)
  callbackUrl.searchParams.set("token_hash", linkData.properties.hashed_token)
  callbackUrl.searchParams.set("type", "magiclink")
  callbackUrl.searchParams.set("next", "/dashboard")

  return NextResponse.redirect(callbackUrl)
}
