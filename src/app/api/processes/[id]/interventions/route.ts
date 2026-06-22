/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, hasFullAccess, logAudit } from "@/lib/auth"
import { NextResponse } from "next/server"

// GET /api/processes/[id]/interventions — list all cases for the process
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (!hasFullAccess(profile.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 })

  const { id } = await params
  const supabase = createServiceClient()

  const { data: process } = await supabase
    .from("processes")
    .select("center_id")
    .eq("id", id)
    .eq("center_id", profile.center_id)
    .single()
  if (!process) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  const { data, error } = await (supabase as any)
    .from("intervention_cases")
    .select(`
      *,
      students(id, first_name, last_name, current_class, gender, behavior_level, needs_type),
      intervention_actions(*)
    `)
    .eq("process_id", id)
    .order("updated_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit(profile.id, profile.center_id, "view_interventions", "process", { processId: id })
  return NextResponse.json(data ?? [])
}

// POST /api/processes/[id]/interventions — create or upsert a case for a student
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (!hasFullAccess(profile.role)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 })

  const { id } = await params
  const supabase = createServiceClient()

  const { data: process } = await supabase
    .from("processes")
    .select("center_id")
    .eq("id", id)
    .eq("center_id", profile.center_id)
    .single()
  if (!process) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  const body = await req.json()
  const { student_id, reason, priority, assigned_to, assigned_to_name, due_date } = body
  if (!student_id || !reason) return NextResponse.json({ error: "student_id y reason requeridos" }, { status: 400 })

  // Upsert: one case per student per process
  const { data, error } = await (supabase as any)
    .from("intervention_cases")
    .upsert({
      process_id: id,
      student_id,
      reason,
      priority: priority ?? "media",
      assigned_to: assigned_to ?? null,
      assigned_to_name: assigned_to_name ?? null,
      due_date: due_date ?? null,
      created_by: profile.id,
      created_by_name: profile.name,
      updated_at: new Date().toISOString(),
    }, { onConflict: "process_id,student_id" })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit(profile.id, profile.center_id, "create_intervention_case", "student", {
    processId: id,
    metadata: { student_id, reason, priority },
  })
  return NextResponse.json(data)
}