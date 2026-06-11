import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params
  const supabase = createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: studentProfile, error } = await (supabase as any)
    .from("student_profiles")
    .select("*")
    .eq("id", id)
    .eq("center_id", profile.center_id)
    .single()

  if (error || !studentProfile) {
    return NextResponse.json({ error: "Perfil no encontrado" }, { status: 404 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: students } = await (supabase as any)
    .from("students")
    .select("*, processes(id, name, school_year, status, target_level)")
    .eq("student_profile_id", id)
    .order("created_at", { ascending: false })

  const trajectory = []
  for (const s of (students ?? [])) {
    const [{ data: metrics }, { data: assignment }] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from("sociogram_metrics")
        .select("received_count, given_count, reciprocal_count, centrality, isolation_score")
        .eq("student_id", s.id)
        .maybeSingle(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from("proposal_assignments")
        .select("target_class, proposals(status, name)")
        .eq("student_id", s.id)
        .maybeSingle(),
    ])
    trajectory.push({ student: s, process: s.processes, sociogram: metrics, final_assignment: assignment })
  }

  return NextResponse.json({ profile: studentProfile, trajectory })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const supabase = createServiceClient()

  const allowed = [
    "first_name", "last_name", "external_id", "gender", "current_class",
    "birth_year", "average_grade", "academic_level", "behavior_level", "needs_type",
    "observations", "school_year",
  ]
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const k of allowed) {
    if (k in body) updates[k] = body[k]
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("student_profiles")
    .update(updates)
    .eq("id", id)
    .eq("center_id", profile.center_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params
  const supabase = createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("student_profiles")
    .delete()
    .eq("id", id)
    .eq("center_id", profile.center_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
