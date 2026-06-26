import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, hasFullAccess, tutorCanAccessProcess } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const { id } = await params
  const supabase = createServiceClient()

  const { data: proc } = await supabase.from("processes").select("center_id").eq("id", id).single()
  if (!proc || proc.center_id !== profile.center_id) return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  if (!hasFullAccess(profile.role) && !(await tutorCanAccessProcess(profile.center_id, profile.id, id))) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const classFilter = searchParams.get("class_name")

  // Load all sessions (optionally filtered by class)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let sessQuery = (supabase as any)
    .from("group_sessions")
    .select(`
      id, name, class_name,
      group_sets(id, name, status, generated_at,
        group_assignments(student_id, group_number)
      )
    `)
    .eq("process_id", id)
    .order("created_at", { ascending: true })

  if (classFilter) sessQuery = sessQuery.eq("class_name", classFilter)
  const { data: sessions } = await sessQuery

  // Load students
  let stuQuery = supabase
    .from("students")
    .select("id, first_name, last_name, current_class, gender, average_grade, academic_level")
    .eq("process_id", id)
    .eq("active", true)

  if (classFilter) stuQuery = stuQuery.eq("current_class", classFilter)
  const { data: students } = await stuQuery

  // For each session pick the most relevant set: approved > latest by generated_at
  const pairs = new Map<string, number>() // "a|b" → count

  let totalSessions = 0

  for (const session of (sessions ?? [])) {
    const sets: Array<{
      id: string
      status: string
      generated_at: string
      group_assignments: Array<{ student_id: string; group_number: number }>
    }> = session.group_sets ?? []

    if (sets.length === 0) continue
    totalSessions++

    // Prefer approved set; otherwise take the most recent
    const chosen =
      sets.find((s) => s.status === "aprobado") ??
      sets.sort((a, b) => new Date(b.generated_at).getTime() - new Date(a.generated_at).getTime())[0]

    // Build cohabitation pairs from this set
    const byGroup = new Map<number, string[]>()
    for (const a of chosen.group_assignments ?? []) {
      if (!byGroup.has(a.group_number)) byGroup.set(a.group_number, [])
      byGroup.get(a.group_number)!.push(a.student_id)
    }

    for (const [, members] of byGroup) {
      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
          const key = [members[i], members[j]].sort().join("|")
          pairs.set(key, (pairs.get(key) ?? 0) + 1)
        }
      }
    }
  }

  const pairsArray = [...pairs.entries()].map(([key, count]) => {
    const [student_a, student_b] = key.split("|")
    return { student_a, student_b, count }
  })

  return NextResponse.json({
    students: students ?? [],
    pairs: pairsArray,
    total_sessions: totalSessions,
  })
}
