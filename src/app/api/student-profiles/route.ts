import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, getStudentAccessScope, canSeeClass } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const body = await request.json()
  const { first_name, last_name, current_class, gender, average_grade, email, observations } = body

  if (!first_name?.trim() || !last_name?.trim()) {
    return NextResponse.json({ error: "Nombre y apellidos son obligatorios" }, { status: 400 })
  }

  // Quien no ve todo el centro solo puede dar de alta alumnos en los grupos que tiene asignados.
  const scope = await getStudentAccessScope(profile.center_id, profile.id, profile.role)
  if (!canSeeClass(scope, current_class?.trim() || null)) {
    return NextResponse.json({ error: "No tienes acceso a ese grupo" }, { status: 403 })
  }

  const supabase = createServiceClient()

  // external_id is assigned automatically by DB trigger (student_auto_id_trigger)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("student_profiles")
    .insert({
      center_id: profile.center_id,
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      current_class: current_class?.trim() || null,
      gender: gender || null,
      average_grade: average_grade !== "" && average_grade != null ? parseFloat(average_grade) : null,
      email: email?.trim() || null,
      observations: observations?.trim() || null,
    })
    .select()
    .single()

  // Índice único (centro, nombre, apellidos): mensaje genérico, sin volcar el error de la base de datos
  if (error?.code === "23505") {
    return NextResponse.json({ error: "Ya existe un alumno con ese nombre y apellidos en el centro" }, { status: 409 })
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function GET(request: Request) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const q = searchParams.get("q") ?? ""
  const filterClass = searchParams.get("class") ?? ""
  const filterBehavior = searchParams.get("behavior") ?? ""
  const filterNeeds = searchParams.get("needs") ?? ""
  const filterGender = searchParams.get("gender") ?? ""
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"))
  const includeInactive = searchParams.get("include_inactive") === "true"
  const pageSize = 50

  // Un profesor/tutor solo ve el alumnado de sus grupos (los que imparte en EduPlataforma o tutoriza).
  const scope = await getStudentAccessScope(profile.center_id, profile.id, profile.role)
  if (!scope.all && scope.classes.length === 0) return NextResponse.json({ profiles: [], total: 0 })

  const supabase = createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("student_profiles")
    .select("*", { count: "exact" })
    .eq("center_id", profile.center_id)
    .order("last_name")
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (!scope.all) query = query.in("current_class", scope.classes)
  if (!includeInactive) query = query.eq("active", true)
  if (q) query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,external_id.ilike.%${q}%`)
  if (filterClass) query = query.eq("current_class", filterClass)
  if (filterBehavior) query = query.eq("behavior_level", filterBehavior)
  if (filterGender) query = query.eq("gender", filterGender)
  if (filterNeeds === "true") query = query.not("needs_type", "in", '("No","")')

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ profiles: data ?? [], total: count ?? 0 })
}
