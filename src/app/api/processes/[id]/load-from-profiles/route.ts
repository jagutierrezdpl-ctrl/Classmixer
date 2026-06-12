import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (!["admin", "superadmin"].includes(profile.role)) {
    return NextResponse.json({ error: "Solo administradores pueden cargar alumnos" }, { status: 403 })
  }

  const { id: processId } = await params
  const body = await request.json()
  const { groups, profile_ids } = body as { groups?: string[]; profile_ids?: string[] }

  if ((!groups || groups.length === 0) && (!profile_ids || profile_ids.length === 0)) {
    return NextResponse.json({ error: "Debes seleccionar al menos un grupo o alumno" }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Verify process belongs to this center
  const { data: process } = await supabase
    .from("processes")
    .select("id, center_id, status")
    .eq("id", processId)
    .eq("center_id", profile.center_id)
    .single()

  if (!process) return NextResponse.json({ error: "Proceso no encontrado" }, { status: 404 })
  if (["cerrado", "archivado"].includes(process.status)) {
    return NextResponse.json({ error: "No se pueden añadir alumnos a un proceso cerrado" }, { status: 400 })
  }

  // Fetch student profiles — by group or by individual IDs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let profilesQuery = (supabase as any)
    .from("student_profiles")
    .select("*")
    .eq("center_id", profile.center_id)

  if (profile_ids && profile_ids.length > 0) {
    profilesQuery = profilesQuery.in("id", profile_ids)
  } else {
    profilesQuery = profilesQuery.in("current_class", groups!)
  }

  const { data: profiles, error: profilesError } = await profilesQuery

  if (profilesError) return NextResponse.json({ error: profilesError.message }, { status: 500 })
  if (!profiles || profiles.length === 0) {
    return NextResponse.json({ error: "No se encontraron alumnos" }, { status: 400 })
  }

  // Get existing students in this process (to avoid duplicates via student_profile_id)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from("students")
    .select("student_profile_id")
    .eq("process_id", processId)
    .not("student_profile_id", "is", null)

  const existingProfileIds = new Set((existing ?? []).map((s: { student_profile_id: string }) => s.student_profile_id))

  // Also check for duplicates by external_id
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingByExternal } = await (supabase as any)
    .from("students")
    .select("external_id")
    .eq("process_id", processId)
    .not("external_id", "is", null)

  const existingExternalIds = new Set((existingByExternal ?? []).map((s: { external_id: string }) => s.external_id))

  // Build student rows
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const newStudents = (profiles as any[])
    .filter(p => {
      if (existingProfileIds.has(p.id)) return false
      if (p.external_id && existingExternalIds.has(p.external_id)) return false
      return true
    })
    .map(p => ({
      process_id: processId,
      student_profile_id: p.id,
      external_id: p.external_id ?? null,
      first_name: p.first_name,
      last_name: p.last_name,
      email: p.email ?? null,
      current_class: p.current_class ?? "",
      gender: p.gender ?? null,
      average_grade: p.average_grade != null ? p.average_grade : 5.0,
      academic_level: p.academic_level ?? null,
      behavior_level: p.behavior_level ?? null,
      needs_type: p.needs_type ?? null,
      observations: p.observations ?? null,
      active: true,
    }))

  if (newStudents.length === 0) {
    return NextResponse.json({
      added: 0,
      skipped: profiles.length,
      message: "Todos los alumnos de esos grupos ya estaban en el proceso",
    })
  }

  // Insert in batches — retry without email if column doesn't exist yet (migration 018)
  let added = 0
  for (let i = 0; i < newStudents.length; i += 100) {
    const batch = newStudents.slice(i, i + 100)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let { error } = await (supabase as any).from("students").insert(batch)
    if (error?.message?.includes("email")) {
      // Migration 018 not yet applied — retry without email field
      const batchWithoutEmail = batch.map(({ email: _e, ...rest }: { email?: string | null; [key: string]: unknown }) => rest)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const retry = await (supabase as any).from("students").insert(batchWithoutEmail)
      error = retry.error
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    added += batch.length
  }

  return NextResponse.json({
    added,
    skipped: profiles.length - added,
    total_profiles: profiles.length,
  })
}
