import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, logAudit } from "@/lib/auth"
import { NextResponse } from "next/server"
import type { Database } from "@/types/database"

type CenterUpdate = Database["public"]["Tables"]["centers"]["Update"]

export async function GET() {
  const profile = await getUserProfile()
  if (!profile || !["admin", "superadmin"].includes(profile.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from("centers")
    .select("id, name, address, city, country, openrouter_api_key")
    .eq("id", profile.center_id)
    .single()

  if (error || !data) return NextResponse.json({ error: "Centro no encontrado" }, { status: 404 })
  const { openrouter_api_key, ...rest } = data
  return NextResponse.json({ ...rest, openrouter_key_set: !!openrouter_api_key })
}

export async function PATCH(request: Request) {
  const profile = await getUserProfile()
  if (!profile || !["admin", "superadmin"].includes(profile.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const body = await request.json()
  const { name, address, city, country, openrouterApiKey } = body

  if (!name?.trim() || name.trim().length < 2) {
    return NextResponse.json({ error: "El nombre debe tener al menos 2 caracteres" }, { status: 400 })
  }

  const updateData: CenterUpdate = {
    name: name.trim(),
    address: address?.trim() || null,
    city: city?.trim() || null,
    country: country?.trim() || null,
  }
  if (openrouterApiKey !== undefined) {
    updateData.openrouter_api_key = typeof openrouterApiKey === "string" && openrouterApiKey.trim() ? openrouterApiKey.trim() : null
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from("centers")
    .update(updateData)
    .eq("id", profile.center_id)
    .select("id, name, address, city, country, openrouter_api_key")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (openrouterApiKey !== undefined) {
    await logAudit(profile.id, profile.center_id, "update_openrouter_key", "center", {
      metadata: { action: updateData.openrouter_api_key ? "set" : "removed" },
    })
  }

  const { openrouter_api_key, ...rest } = data
  return NextResponse.json({ ...rest, openrouter_key_set: !!openrouter_api_key })
}
