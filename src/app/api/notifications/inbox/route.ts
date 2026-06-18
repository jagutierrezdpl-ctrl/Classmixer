/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"

// GET /api/notifications/inbox — list last 20 notifications for this user/center
export async function GET() {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const supabase = createServiceClient() as any

  const { data } = await supabase
    .from("app_notifications")
    .select("*")
    .eq("center_id", profile.center_id)
    .or(`user_id.is.null,user_id.eq.${profile.id}`)
    .order("created_at", { ascending: false })
    .limit(20)

  return NextResponse.json(data ?? [], { headers: { "Cache-Control": "no-store" } })
}

// PATCH /api/notifications/inbox — mark all as read (or single by id)
export async function PATCH(req: NextRequest) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const supabase = createServiceClient() as any

  if (body.id) {
    await supabase
      .from("app_notifications")
      .update({ read: true })
      .eq("id", body.id)
      .eq("center_id", profile.center_id)
  } else {
    await supabase
      .from("app_notifications")
      .update({ read: true })
      .eq("center_id", profile.center_id)
      .or(`user_id.is.null,user_id.eq.${profile.id}`)
  }

  return NextResponse.json({ ok: true })
}
