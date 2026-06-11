import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await getUserProfile()
  if (!profile || profile.role !== "superadmin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { id } = await params
  const supabase = createServiceClient()

  const { data: center, error } = await supabase
    .from("centers")
    .select("*")
    .eq("id", id)
    .single()

  if (error || !center) return NextResponse.json({ error: "Centro no encontrado" }, { status: 404 })

  const [
    { data: users },
    { data: processes },
    { count: studentCount },
    { count: responseCount },
    { data: recentActivity },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { data: notes },
    { data: license },
  ] = await Promise.all([
    supabase.from("users").select("id, name, email, role, created_at").eq("center_id", id).order("created_at"),
    supabase.from("processes").select("id, name, school_year, status, process_type, created_at, source_level, target_level")
      .eq("center_id", id).order("created_at", { ascending: false }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from("student_profiles").select("id", { count: "exact", head: true }).eq("center_id", id).eq("active", true),
    supabase.from("responses").select("id", { count: "exact", head: true })
      .in("process_id",
        (await supabase.from("processes").select("id").eq("center_id", id)).data?.map((p: { id: string }) => p.id) ?? ["__none__"]
      ),
    supabase.from("audit_logs")
      .select("id, action, entity_type, created_at, users(name, email)")
      .eq("center_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from("admin_center_notes")
      .select("*")
      .eq("center_id", id)
      .order("created_at", { ascending: false }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from("licenses")
      .select("plan, max_processes, max_students, active")
      .eq("center_id", id)
      .maybeSingle(),
  ])

  return NextResponse.json({
    center,
    users: users ?? [],
    processes: processes ?? [],
    student_count: studentCount ?? 0,
    response_count: responseCount ?? 0,
    recent_activity: recentActivity ?? [],
    notes: notes ?? [],
    license: license ?? null,
  })
}
