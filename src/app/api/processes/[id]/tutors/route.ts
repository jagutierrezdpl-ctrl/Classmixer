import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, hasFullAccess, tutorCanAccessProcess, logAudit } from "@/lib/auth"
import { NextResponse } from "next/server"

async function getOwnedProcess(processId: string, centerId: string) {
  const supabase = createServiceClient()
  const { data: process } = await supabase
    .from("processes")
    .select("center_id, source_groups, school_year")
    .eq("id", processId)
    .single()
  if (!process || process.center_id !== centerId) return null
  return process
}

// Auto-inserta en process_tutors los tutores de los grupos de origen.
// Si source_groups está vacío, infiere los grupos desde los alumnos del proceso.
// No filtra por school_year para evitar desajustes de formato de año.
async function syncGroupTutors(processId: string, sourceGroups: string[], centerId: string) {
  const supabase = createServiceClient()

  let groups = sourceGroups?.filter(Boolean) ?? []

  // Fallback: inferir grupos desde current_class de los alumnos si source_groups está vacío
  if (!groups.length) {
    const { data: students } = await supabase
      .from("students")
      .select("current_class")
      .eq("process_id", processId)
      .eq("active", true)
      .not("current_class", "is", null)

    const inferred = [...new Set((students ?? []).map(s => s.current_class).filter(Boolean))] as string[]
    groups = inferred
  }

  if (!groups.length) return

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: groupTutors } = await (supabase as any)
    .from("group_tutors")
    .select("user_id")
    .eq("center_id", centerId)
    .in("group_name", groups)

  if (!groupTutors?.length) return

  // Dedup: un tutor puede estar en varios grupos o cursos
  const uniqueUserIds = [...new Set((groupTutors as { user_id: string }[]).map(gt => gt.user_id))]

  const rows = uniqueUserIds.map(user_id => ({ process_id: processId, user_id }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("process_tutors")
    .upsert(rows, { onConflict: "process_id,user_id" })
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params

  const process = await getOwnedProcess(id, profile.center_id)
  if (!process) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  }
  if (!hasFullAccess(profile.role) && !(await tutorCanAccessProcess(profile.center_id, profile.id, id))) {
    return NextResponse.json({ error: "Sin acceso a este proceso" }, { status: 403 })
  }

  // Auto-asignar tutores de los grupos de origen si aún no están en el equipo
  await syncGroupTutors(id, process.source_groups ?? [], profile.center_id)

  const supabase = createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("process_tutors")
    .select("*, users(id, name, email, role)")
    .eq("process_id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await getUserProfile()
  if (!profile || !["admin", "superadmin"].includes(profile.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { id } = await params

  if (!(await getOwnedProcess(id, profile.center_id))) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  }

  const body = await request.json()
  const { user_id } = body

  if (!user_id) return NextResponse.json({ error: "user_id requerido" }, { status: 400 })

  const supabase = createServiceClient()

  // Verify user belongs to same center
  const { data: target } = await supabase
    .from("users")
    .select("center_id")
    .eq("id", user_id)
    .single()

  if (!target || target.center_id !== profile.center_id) {
    return NextResponse.json({ error: "Usuario no pertenece al centro" }, { status: 403 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("process_tutors")
    .insert({ process_id: id, user_id, assigned_by: profile.id })

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Usuario ya asignado" }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logAudit(profile.id, profile.center_id, "assign_tutor", "process", {
    processId: id,
    metadata: { user_id },
  })

  return NextResponse.json({ ok: true })
}
