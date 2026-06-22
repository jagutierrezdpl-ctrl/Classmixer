/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, hasFullAccess, logAudit } from "@/lib/auth"
import { NextResponse } from "next/server"

// PATCH /api/processes/[id]/interventions/[caseId] — update status, priority, assignee
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; caseId: string }> }
) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (!hasFullAccess(profile.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 })

  const { id, caseId } = await params
  const supabase = createServiceClient()

  // Verify case belongs to a process in the same center
  const { data: existing } = await (supabase as any)
    .from("intervention_cases")
    .select("id, process_id, processes(center_id)")
    .eq("id", caseId)
    .single()

  if (!existing || (existing.processes as any)?.center_id !== profile.center_id) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  }

  const body = await req.json()
  const allowedFields = ["status", "priority", "assigned_to", "assigned_to_name", "due_date"]
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of allowedFields) {
    if (key in body) update[key] = body[key]
  }
  if (body.status === "resuelto" && !existing.resolved_at) {
    update.resolved_at = new Date().toISOString()
  }

  const { data, error } = await (supabase as any)
    .from("intervention_cases")
    .update(update)
    .eq("id", caseId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit(profile.id, profile.center_id, "update_intervention_case", "intervention", {
    processId: id,
    metadata: { caseId, changes: update },
  })
  return NextResponse.json(data)
}

// DELETE /api/processes/[id]/interventions/[caseId] — close/delete a case
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; caseId: string }> }
) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (!["admin", "superadmin"].includes(profile.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 })

  const { id, caseId } = await params
  const supabase = createServiceClient()

  const { data: existing } = await (supabase as any)
    .from("intervention_cases")
    .select("id, processes(center_id)")
    .eq("id", caseId)
    .single()

  if (!existing || (existing.processes as any)?.center_id !== profile.center_id) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  }

  await (supabase as any).from("intervention_cases").delete().eq("id", caseId)

  await logAudit(profile.id, profile.center_id, "delete_intervention_case", "intervention", {
    processId: id,
    metadata: { caseId },
  })
  return NextResponse.json({ ok: true })
}

// POST /api/processes/[id]/interventions/[caseId]?action=true — add an action to the case
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; caseId: string }> }
) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (!hasFullAccess(profile.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 })

  const { caseId } = await params
  const supabase = createServiceClient()

  const { data: existing } = await (supabase as any)
    .from("intervention_cases")
    .select("id, processes(center_id)")
    .eq("id", caseId)
    .single()

  if (!existing || (existing.processes as any)?.center_id !== profile.center_id) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  }

  const body = await req.json()
  const { action_type, description } = body
  if (!description?.trim()) return NextResponse.json({ error: "description requerida" }, { status: 400 })

  const { data, error } = await (supabase as any)
    .from("intervention_actions")
    .insert({
      case_id: caseId,
      action_type: action_type ?? "nota",
      description: description.trim(),
      completed_at: new Date().toISOString(),
      created_by: profile.id,
      created_by_name: profile.name,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Auto-advance case status when first action is added
  await (supabase as any)
    .from("intervention_cases")
    .update({ status: "en_revision", updated_at: new Date().toISOString() })
    .eq("id", caseId)
    .eq("status", "detectado") // only if still in initial state

  return NextResponse.json(data)
}