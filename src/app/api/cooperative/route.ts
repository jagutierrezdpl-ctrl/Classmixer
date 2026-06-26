/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, hasFullAccess, tutorCanAccessProcess } from "@/lib/auth"
import { NextResponse } from "next/server"

// GET — list all group_sessions the user can access, across all processes in the center.
// Returns each session enriched with its process info so the client can build deep links.
export async function GET(_req: Request) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const supabase = createServiceClient()

  // Fetch all processes in this center the user has access to
  const { data: processes } = await supabase
    .from("processes")
    .select("id, name")
    .eq("center_id", profile.center_id)

  if (!processes || processes.length === 0) return NextResponse.json([])

  // For tutors, filter to only processes they can access
  let accessibleProcessIds: string[]
  if (hasFullAccess(profile.role)) {
    accessibleProcessIds = processes.map(p => p.id)
  } else {
    const checks = await Promise.all(
      processes.map(p => tutorCanAccessProcess(profile.center_id, profile.id, p.id).then(ok => ok ? p.id : null))
    )
    accessibleProcessIds = checks.filter(Boolean) as string[]
  }

  if (accessibleProcessIds.length === 0) return NextResponse.json([])

  const { data, error } = await (supabase as any)
    .from("group_sessions")
    .select("*, group_sets(id, name, status, score_total, generated_at), sociogram_snapshots(id, name)")
    .in("process_id", accessibleProcessIds)
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Attach process name for display
  const processMap = new Map(processes.map(p => [p.id, p.name]))
  const enriched = (data ?? []).map((s: any) => ({
    ...s,
    process_name: processMap.get(s.process_id) ?? null,
  }))

  return NextResponse.json(enriched)
}

// POST — create a group_session without requiring the caller to know the process_id.
// The API auto-selects the most recent process that has students for the given class_name.
export async function POST(req: Request) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const body = await req.json()
  const { class_name, ...rest } = body

  if (!class_name) return NextResponse.json({ error: "class_name requerido" }, { status: 400 })

  const supabase = createServiceClient()

  // Find the most recent process in this center that has active students in the given class
  const { data: match } = await (supabase as any)
    .from("students")
    .select("process_id, processes!inner(center_id, id, created_at)")
    .eq("current_class", class_name)
    .eq("active", true)
    .eq("processes.center_id", profile.center_id)
    .order("processes(created_at)", { ascending: false })
    .limit(1)
    .single()

  if (!match) {
    return NextResponse.json(
      { error: `No hay alumnos cargados para la clase "${class_name}". Crea primero un proceso con esa clase.` },
      { status: 404 }
    )
  }

  const processId = match.process_id

  // Authorization check for non-admins
  if (!hasFullAccess(profile.role)) {
    const ok = await tutorCanAccessProcess(profile.center_id, profile.id, processId)
    if (!ok) return NextResponse.json({ error: "Sin acceso a esa clase" }, { status: 403 })
  }

  const sizes: number[] | undefined =
    Array.isArray(rest.group_sizes) && rest.group_sizes.length > 0 ? rest.group_sizes : undefined

  const { data, error } = await (supabase as any)
    .from("group_sessions")
    .insert({
      process_id: processId,
      class_name,
      name: rest.name ?? "Nueva sesión",
      num_groups: sizes ? sizes.length : (rest.num_groups ?? 4),
      group_sizes: sizes ?? null,
      balance_gender: rest.balance_gender ?? true,
      balance_academic: rest.balance_academic ?? true,
      use_sociogram: rest.use_sociogram ?? false,
      max_per_group: null,
      sociogram_snapshot_id: rest.sociogram_snapshot_id ?? null,
      created_by: profile.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
