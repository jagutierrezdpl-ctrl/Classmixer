import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, getStudentAccessScope } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function GET() {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const supabase = createServiceClient()

  // Quien no ve todo el centro solo ve sus grupos: los que tutoriza en ClassMixer y los que
  // imparte según EduPlataforma.
  const scope = await getStudentAccessScope(profile.center_id, profile.id, profile.role)
  if (!scope.all && scope.classes.length === 0) return NextResponse.json([])
  const allowedGroups: string[] | null = scope.all ? null : scope.classes

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

  const { data: students, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Also include groups registered in center_groups (even if empty), restricted to the
  // person's own groups when they don't see the whole center
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let centerGroupsQuery = (supabase as any)
    .from("center_groups")
    .select("name, school_year")
    .eq("center_id", profile.center_id)
  if (allowedGroups !== null) centerGroupsQuery = centerGroupsQuery.in("name", allowedGroups)
  const { data: centerGroups } = await centerGroupsQuery

  // Get group-tutor assignments for this center
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: groupTutors } = await (supabase as any)
    .from("group_tutors")
    .select("group_name, school_year, user_id, users(id, name, email)")
    .eq("center_id", profile.center_id)

  // Build group map — seed from center_groups first so empty groups appear
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const groupMap: Record<string, any> = {}

  for (const cg of (centerGroups ?? [])) {
    groupMap[cg.name] = {
      name: cg.name,
      count: 0,
      female: 0,
      male: 0,
      with_needs: 0,
      school_year: cg.school_year || null,
      tutor: null,
      registered: true,
    }
  }

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

  // `mine`: grupos de la persona (todos los que ve, si no ve el centro entero; si lo ve
  // entero, solo aquellos de los que es tutor). Es lo que muestra "Mis Grupos".
  const groups = Object.values(groupMap)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((g: any) => ({ ...g, mine: allowedGroups !== null || g.tutor?.id === profile.id }))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .sort((a: any, b: any) => a.name.localeCompare(b.name))

  return NextResponse.json(groups)
}
