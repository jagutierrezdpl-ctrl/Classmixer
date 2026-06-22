import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, logAudit } from "@/lib/auth"
import { NextResponse } from "next/server"

async function getProposalWithOwnerCheck(supabase: ReturnType<typeof createServiceClient>, proposalId: string, centerId: string) {
  const { data, error } = await supabase
    .from("proposals")
    .select("*, processes!inner(center_id)")
    .eq("id", proposalId)
    .single()
  if (error || !data) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((data as any).processes?.center_id !== centerId) return null
  return data
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params
  const supabase = createServiceClient()

  const owned = await getProposalWithOwnerCheck(supabase, id, profile.center_id)
  if (!owned) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

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
  const supabase = createServiceClient()

  const owned = await getProposalWithOwnerCheck(supabase, id, profile.center_id)
  if (!owned) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  // Role check BEFORE any write — approving is admin-only
  if (body.status === "aprobada" && !["admin", "superadmin"].includes(profile.role)) {
    return NextResponse.json({ error: "Solo administradores pueden aprobar propuestas" }, { status: 403 })
  }

  const allowed: { status?: string; name?: string } = {}
  if ("status" in body) allowed.status = body.status
  if ("name" in body) allowed.name = body.name
  if (Object.keys(allowed).length === 0) {
    return NextResponse.json({ error: "Sin campos para actualizar" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("proposals")
    .update(allowed)
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
