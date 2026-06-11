import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function GET() {
  const profile = await getUserProfile()
  if (!profile || !["admin", "superadmin"].includes(profile.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from("centers")
    .select("id, name, address, city, country")
    .eq("id", profile.center_id)
    .single()

  if (error || !data) return NextResponse.json({ error: "Centro no encontrado" }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(request: Request) {
  const profile = await getUserProfile()
  if (!profile || !["admin", "superadmin"].includes(profile.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const body = await request.json()
  const { name, address, city, country } = body

  if (!name?.trim() || name.trim().length < 2) {
    return NextResponse.json({ error: "El nombre debe tener al menos 2 caracteres" }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from("centers")
    .update({
      name: name.trim(),
      address: address?.trim() || null,
      city: city?.trim() || null,
      country: country?.trim() || null,
    })
    .eq("id", profile.center_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
