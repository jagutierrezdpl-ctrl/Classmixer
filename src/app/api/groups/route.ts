import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, hasFullAccess } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function GET() {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (!hasFullAccess(profile.role)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 })
  }

  const supabase = createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("center_groups")
    .select("id, name, school_year, created_at")
    .eq("center_id", profile.center_id)
    .order("name")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const profile = await getUserProfile()
  if (!profile || !hasFullAccess(profile.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const body = await request.json()
  const { name, school_year } = body

  if (!name?.trim()) {
    return NextResponse.json({ error: "El nombre del grupo es obligatorio" }, { status: 400 })
  }

  const supabase = createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("center_groups")
    .insert({ center_id: profile.center_id, name: name.trim(), school_year: school_year ?? "" })
    .select()
    .single()

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: `Ya existe un grupo llamado "${name.trim()}"` }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(request: Request) {
  const profile = await getUserProfile()
  if (!profile || !hasFullAccess(profile.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const name = searchParams.get("name")
  if (!name) return NextResponse.json({ error: "Falta el nombre del grupo" }, { status: 400 })

  const supabase = createServiceClient()

  // Block deletion if group has students
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count } = await (supabase as any)
    .from("student_profiles")
    .select("id", { count: "exact", head: true })
    .eq("center_id", profile.center_id)
    .eq("current_class", name)

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: `El grupo "${name}" tiene alumnos asignados. Reasígnalos antes de eliminarlo.` },
      { status: 409 }
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("center_groups")
    .delete()
    .eq("center_id", profile.center_id)
    .eq("name", name)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
