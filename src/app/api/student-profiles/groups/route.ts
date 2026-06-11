import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, hasFullAccess, getTutorGroups } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function GET() {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const supabase = createServiceClient()

  // Tutors only see their assigned groups
  let allowedGroups: string[] | null = null
  if (!hasFullAccess(profile.role)) {
    allowedGroups = await getTutorGroups(profile.center_id, profile.id)
    if (allowedGroups.length === 0) return NextResponse.json([])
  }

  // Get all student profiles for this center grouped by current_class
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("student_profiles")
    .select("id, current_class, gender, academic_level, needs_type, school_year")
    .eq("center_id", profile.center_id)
    .not("current_class", "is", null)

  if (allowedGroups !== null) {
    query = query.in("current_class", allowedGroups)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: students, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Get group-tutor assignments for this center
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: groupTutors } = await (supabase as any)
    .from("group_tutors")
    .select("group_name, school_year, user_id, users(id, name, email)")
    .eq("center_id", profile.center_id)

  // Build group map
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const groupMap: Record<string, any> = {}

  for (const s of (students ?? [])) {
    const cls = s.current_class as string
    if (!groupMap[cls]) {
      groupMap[cls] = {
        name: cls,
        count: 0,
        female: 0,
        male: 0,
        with_needs: 0,
        school_year: s.school_year,
        tutor: null,
      }
    }
    groupMap[cls].count++
    if (s.gender === "F") groupMap[cls].female++
    if (s.gender === "M") groupMap[cls].male++
    if (s.needs_type && s.needs_type !== "No") groupMap[cls].with_needs++
  }

  // Attach tutors
  for (const gt of (groupTutors ?? [])) {
    if (groupMap[gt.group_name]) {
      groupMap[gt.group_name].tutor = gt.users
      groupMap[gt.group_name].tutor_school_year = gt.school_year
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const groups = Object.values(groupMap).sort((a: any, b: any) => a.name.localeCompare(b.name))

  return NextResponse.json(groups)
}
