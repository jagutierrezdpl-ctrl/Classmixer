import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function GET() {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  return NextResponse.json({
    id: profile.id,
    email: profile.email,
    name: profile.name,
    role: profile.role,
    center_id: profile.center_id,
  })
}

export async function PATCH(request: Request) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const { name } = await request.json()
  if (!name?.trim()) return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 })
  const supabase = createServiceClient()
  const { error } = await supabase.from("users").update({ name: name.trim() }).eq("id", profile.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
