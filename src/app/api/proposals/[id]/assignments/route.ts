import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, logAudit } from "@/lib/auth"
import { NextResponse } from "next/server"

interface AssignmentInput {
  student_id: string
  target_class: string
  locked: boolean
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (!["admin", "superadmin"].includes(profile.role)) {
    return NextResponse.json({ error: "Solo administradores pueden modificar asignaciones" }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json()
  const assignments: AssignmentInput[] = body.assignments ?? []

  if (assignments.length === 0) {
    return NextResponse.json({ error: "Sin asignaciones" }, { status: 400 })
  }

  const supabase = createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: proposal, error: propError } = await (supabase as any)
    .from("proposals")
    .select("id, process_id, processes!inner(center_id)")
    .eq("id", id)
    .single() as { data: { id: string; process_id: string; processes: { center_id: string } } | null; error: unknown }

  if (propError || !proposal) {
    return NextResponse.json({ error: "Propuesta no encontrada" }, { status: 404 })
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((proposal as any).processes?.center_id !== profile.center_id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  // Replace all assignments
  await supabase.from("proposal_assignments").delete().eq("proposal_id", id)

  const { error: insertError } = await supabase.from("proposal_assignments").insert(
    assignments.map(a => ({
      proposal_id: id,
      student_id: a.student_id,
      target_class: a.target_class,
      locked: a.locked,
    }))
  )

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  // Mark as edited
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from("proposals") as any)
    .update({ status: "editada" })
    .eq("id", id)

  await logAudit(profile.id, profile.center_id, "edit_proposal_assignments", "proposal", {
    processId: proposal.process_id,
    entityId: id,
    metadata: { count: assignments.length },
  })

  return NextResponse.json({ ok: true, updated: assignments.length })
}
