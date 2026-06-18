import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, logAudit, hasFullAccess, getTutorGroups } from "@/lib/auth"
import { NextResponse } from "next/server"
import { createProcessSchema } from "@/schemas"

export async function GET(request: Request) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const supabase = createServiceClient()
  const { searchParams } = new URL(request.url)
  const parentId = searchParams.get("parent_id")

  // Orientador and admin see all center processes
  if (hasFullAccess(profile.role)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from("processes")
      .select("*")
      .eq("center_id", profile.center_id)
      .order("created_at", { ascending: false })
    if (parentId) query = query.eq("parent_process_id", parentId)
    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(parentId ? { processes: data } : data)
  }

  // Tutor: processes explicitly assigned OR whose source_groups overlap their groups
  const tutorGroups = await getTutorGroups(profile.center_id, profile.id)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: assigned } = await (supabase as any)
    .from("process_tutors")
    .select("process_id")
    .eq("user_id", profile.id)
  const assignedIds: string[] = (assigned ?? []).map((a: { process_id: string }) => a.process_id)

  const { data: allProcesses } = await supabase
    .from("processes")
    .select("*")
    .eq("center_id", profile.center_id)
    .order("created_at", { ascending: false })

  const visible = (allProcesses ?? []).filter(p => {
    if (assignedIds.includes(p.id)) return true
    const sourceGroups = (p.source_groups ?? []) as string[]
    return tutorGroups.some(g => sourceGroups.includes(g))
  })

  return NextResponse.json(visible)
}

export async function POST(request: Request) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (!["admin", "superadmin", "tutor", "orientador"].includes(profile.role)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 })
  }

  const body = await request.json()
  const parsed = createProcessSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { source_groups, target_groups, ...rest } = parsed.data
  const sourceGroupList = source_groups.split(",").map((s: string) => s.trim()).filter(Boolean)

  // Tutors can only use their own assigned groups as source
  if (profile.role === "tutor") {
    const tutorGroups = await getTutorGroups(profile.center_id, profile.id)
    const unauthorized = sourceGroupList.filter(g => !tutorGroups.includes(g))
    if (unauthorized.length > 0) {
      return NextResponse.json(
        { error: `No tienes asignados estos grupos: ${unauthorized.join(", ")}` },
        { status: 403 }
      )
    }
  }

  const supabase = createServiceClient()

  // License check: max_processes
  const { getCenterLicense } = await import("@/lib/license")
  const license = await getCenterLicense(supabase, profile.center_id)
  if (license.max_processes !== null) {
    const { count } = await supabase
      .from("processes")
      .select("id", { count: "exact", head: true })
      .eq("center_id", profile.center_id)
      .not("status", "eq", "archivado")
    if ((count ?? 0) >= license.max_processes) {
      return NextResponse.json(
        { error: `Límite de procesos alcanzado (${license.max_processes}) en tu plan ${license.plan}. Archiva procesos anteriores o actualiza tu licencia.` },
        { status: 403 }
      )
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("processes")
    .insert({
      ...rest,
      source_groups: sourceGroupList,
      target_groups: (target_groups ?? "").split(",").map((s: string) => s.trim()).filter(Boolean),
      center_id: profile.center_id,
      created_by: profile.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Create target groups in the groups table if they don't exist yet
  const targetGroupList: string[] = (target_groups ?? "").split(",").map((s: string) => s.trim()).filter(Boolean)
  if (targetGroupList.length > 0) {
    const groupRows = targetGroupList.map(name => ({
      name,
      center_id: profile.center_id,
      school_year: rest.school_year ?? null,
    }))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("groups")
      .upsert(groupRows, { onConflict: "center_id,name", ignoreDuplicates: true })
  }

  // Auto-assign tutor to the process they just created
  if (profile.role === "tutor") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("process_tutors")
      .insert({ process_id: data.id, user_id: profile.id })
  }

  await logAudit(profile.id, profile.center_id, "create_process", "process", {
    entityId: data.id,
    metadata: { name: data.name },
  })

  return NextResponse.json({ id: data.id }, { status: 201 })
}
