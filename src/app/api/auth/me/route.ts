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
