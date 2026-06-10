import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id: processId } = await params
  const body = await request.json()
  const { groups } = body as { groups: string[] }  // array of current_class values

  if (!groups || groups.length === 0) {
    return NextResponse.json({ error: "Debes seleccionar al menos un grupo" }, { status: 400 })
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

  // Fetch student profiles for selected groups
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profiles, error: profilesError } = await (supabase as any)
    .from("student_profiles")
    .select("*")
    .eq("center_id", profile.center_id)
    .in("current_class", groups)

  if (profilesError) return NextResponse.json({ error: profilesError.message }, { status: 500 })
  if (!profiles || profiles.length === 0) {
    return NextResponse.json({ error: "No se encontraron alumnos en los grupos seleccionados" }, { status: 400 })
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
      current_class: p.current_class ?? "",
      gender: p.gender ?? null,
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

  // Insert in batches
  let added = 0
  for (let i = 0; i < newStudents.length; i += 100) {
    const batch = newStudents.slice(i, i + 100)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("students").insert(batch)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    added += batch.length
  }

  return NextResponse.json({
    added,
    skipped: profiles.length - added,
    total_profiles: profiles.length,
  })
}
