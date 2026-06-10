import { createClient } from "@/lib/supabase/server"
import { getUserProfile, logAudit } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("proposals")
    .select("*, proposal_assignments(*, students(*)), proposal_metrics(*)")
    .eq("id", id)
    .single()

  if (error || !data) return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("proposals")
    .update(body)
    .eq("id", id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (body.status === "aprobada") {
    await supabase
      .from("processes")
      .update({ status: "propuesta_seleccionada", updated_at: new Date().toISOString() })
      .eq("id", data.process_id)

    await logAudit(profile.id, profile.center_id, "approve_proposal", "proposal", {
      processId: data.process_id,
      entityId: id,
    })
  }

  return NextResponse.json(data)
}
