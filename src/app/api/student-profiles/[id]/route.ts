import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, logAudit, getStudentAccessScope, canSeeClass, getAccessibleProcessIds, hasFullAccess } from "@/lib/auth"
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

  // Fuera de los grupos del usuario se responde como si no existiera.
  const scope = await getStudentAccessScope(profile.center_id, profile.id, profile.role)
  if (error || !studentProfile || !canSeeClass(scope, studentProfile.current_class)) {
    return NextResponse.json({ error: "Perfil no encontrado" }, { status: 404 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: students } = await (supabase as any)
    .from("students")
    .select("*, processes(id, name, school_year, status, target_level)")
    .eq("student_profile_id", id)
    .order("created_at", { ascending: false })

  // La ficha es del grupo del profesor, pero la trayectoria trae métricas sociométricas de cada
  // proceso en el que participó el alumno: solo las de procesos a los que tiene acceso.
  const accessibleProcessIds = scope.all ? null : await getAccessibleProcessIds(profile)

  const trajectory = []
  for (const s of (students ?? [])) {
    if (accessibleProcessIds && !accessibleProcessIds.has(s.process_id)) continue
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
    "first_name", "last_name", "gender", "current_class",
    "birth_year", "average_grade", "academic_level", "behavior_level", "needs_type",
    "observations", "school_year", "active",
  ]
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const k of allowed) {
    if (k in body) updates[k] = body[k]
  }
  // El grupo se compara por texto exacto: se guarda sin espacios sobrantes (y vacío = sin grupo)
  if (typeof updates.current_class === "string") updates.current_class = updates.current_class.trim() || null

  // Solo se puede editar alumnado de los grupos asignados y no se le puede mover a otro grupo
  // ajeno (el alumno desaparecería de la vista de quien lo edita, o entraría en la de otro).
  const scope = await getStudentAccessScope(profile.center_id, profile.id, profile.role)
  if (!scope.all) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: current } = await (supabase as any)
      .from("student_profiles")
      .select("current_class")
      .eq("id", id)
      .eq("center_id", profile.center_id)
      .maybeSingle()
    if (!current || !canSeeClass(scope, current.current_class)) {
      return NextResponse.json({ error: "Perfil no encontrado" }, { status: 404 })
    }
    if ("current_class" in updates && !canSeeClass(scope, updates.current_class as string | null)) {
      return NextResponse.json({ error: "No tienes acceso a ese grupo" }, { status: 403 })
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let update = (supabase as any)
    .from("student_profiles")
    .update(updates)
    .eq("id", id)
    .eq("center_id", profile.center_id)
  // Comprobación repetida en la propia escritura por si el grupo cambió entre la lectura y ahora.
  if (!scope.all) update = update.in("current_class", scope.classes)
  const { error } = await update

  if (error?.code === "23505") {
    return NextResponse.json({ error: "Ya existe un alumno con ese nombre y apellidos en el centro" }, { status: 409 })
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params
  const supabase = createServiceClient()
  const url = new URL(request.url)
  const permanent = url.searchParams.get("permanent") === "true"

  // Verify the profile belongs to this center before any operation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from("student_profiles")
    .select("id, first_name, last_name, center_id, active, current_class")
    .eq("id", id)
    .eq("center_id", profile.center_id)
    .single()

  const scope = await getStudentAccessScope(profile.center_id, profile.id, profile.role)
  if (!existing || !canSeeClass(scope, existing.current_class)) {
    return NextResponse.json({ error: "Perfil no encontrado" }, { status: 404 })
  }

  if (permanent) {
    // El borrado definitivo no se puede deshacer: solo administración/orientación
    if (!hasFullAccess(profile.role)) {
      return NextResponse.json({ error: "Solo administración puede eliminar definitivamente un perfil" }, { status: 403 })
    }
    // Only allow permanent delete of inactive profiles — safety guard
    if (existing.active !== false) {
      return NextResponse.json({ error: "Solo se pueden eliminar definitivamente perfiles ya dados de baja" }, { status: 400 })
    }
    // Nullify student_profile_id references in the students table first to avoid FK violations
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("students")
      .update({ student_profile_id: null })
      .eq("student_profile_id", id)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("student_profiles")
      .delete()
      .eq("id", id)
      .eq("center_id", profile.center_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await logAudit(profile.id, profile.center_id, "delete_student_profile_permanent", "student", {
      entityId: id,
      metadata: { name: `${existing.first_name} ${existing.last_name}` },
    })
    return NextResponse.json({ success: true, permanent: true })
  }

  // Soft delete — preserves all data and history
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let deactivate = (supabase as any)
    .from("student_profiles")
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("center_id", profile.center_id)
  // Comprobación repetida en la propia escritura por si el grupo cambió entre la lectura y ahora.
  if (!scope.all) deactivate = deactivate.in("current_class", scope.classes)
  const { error } = await deactivate

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, permanent: false })
}
