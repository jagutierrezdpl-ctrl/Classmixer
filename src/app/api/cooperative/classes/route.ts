/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, hasFullAccess, tutorCanAccessProcess, getTutorGroups } from "@/lib/auth"
import { NextResponse } from "next/server"

// Returns distinct class names that have active students in any accessible process
// for this center. Tutors only see their own assigned classes.
export async function GET(_req: Request) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const supabase = createServiceClient()

  // Tutors are restricted to their own assigned classes
  if (profile.role === "tutor") {
    const tutorClasses = await getTutorGroups(profile.center_id, profile.id)
    return NextResponse.json(tutorClasses.sort())
  }

  const { data: processes } = await supabase
    .from("processes")
    .select("id")
    .eq("center_id", profile.center_id)

  if (!processes || processes.length === 0) return NextResponse.json([])

  let accessibleIds: string[]
  if (hasFullAccess(profile.role)) {
    accessibleIds = processes.map(p => p.id)
  } else {
    const checks = await Promise.all(
      processes.map(p => tutorCanAccessProcess(profile.center_id, profile.id, p.id).then(ok => ok ? p.id : null))
    )
    accessibleIds = checks.filter(Boolean) as string[]
  }

  if (accessibleIds.length === 0) return NextResponse.json([])

  const { data } = await (supabase as any)
    .from("students")
    .select("current_class")
    .in("process_id", accessibleIds)
    .eq("active", true)

  const classes = [...new Set((data ?? []).map((s: any) => s.current_class as string))].sort()
  return NextResponse.json(classes)
}
