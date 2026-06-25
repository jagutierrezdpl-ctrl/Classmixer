import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, hasFullAccess, tutorCanAccessProcess } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params
  const supabase = createServiceClient()

  // Load proposal with assignments and student data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: proposal } = await (supabase as any)
    .from("proposals")
    .select("id, process_id, proposal_assignments(student_id, target_class, students(id, first_name, last_name, current_class, gender))")
    .eq("id", id)
    .single()

  if (!proposal) return NextResponse.json({ error: "No encontrada" }, { status: 404 })

  // Auth check via process
  const { data: process } = await supabase
    .from("processes")
    .select("center_id")
    .eq("id", proposal.process_id)
    .single()

  if (!process || process.center_id !== profile.center_id) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 })
  }
  if (!hasFullAccess(profile.role) && !(await tutorCanAccessProcess(profile.center_id, profile.id, proposal.process_id))) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 })
  }

  // Load all response types for the process
  const { data: responses } = await supabase
    .from("responses")
    .select("respondent_student_id, target_student_id, relation_type")
    .eq("process_id", proposal.process_id)
    .in("relation_type", ["friendship", "work", "emotional", "negative"])

  const friendshipResponses = (responses ?? []).filter(r => r.relation_type === "friendship")
  const workResponses = (responses ?? []).filter(r => r.relation_type === "work")
  const emotionalResponses = (responses ?? []).filter(r => r.relation_type === "emotional")
  const negativeResponses = (responses ?? []).filter(r => r.relation_type === "negative")

  // Build class map from assignments
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const assignments = (proposal.proposal_assignments ?? []) as any[]
  const classMap = new Map<string, string>() // student_id → target_class
  assignments.forEach(a => classMap.set(a.student_id, a.target_class))

  // Build student map
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const studentMap = new Map<string, any>()
  assignments.forEach(a => {
    if (a.students) studentMap.set(a.student_id, a.students)
  })

  // For each student, build their friend list with same-class info
  const result = assignments.map(a => {
    const s = a.students ?? {}
    const myClass = a.target_class

    const friendChoices = friendshipResponses
      .filter(r => r.respondent_student_id === a.student_id)
      .map(r => {
        const friend = studentMap.get(r.target_student_id)
        const friendClass = classMap.get(r.target_student_id)
        return {
          id: r.target_student_id,
          first_name: friend?.first_name ?? "—",
          last_name: friend?.last_name ?? "—",
          target_class: friendClass ?? null,
          same_class: friendClass === myClass,
        }
      })

    const mapChoices = (list: typeof responses, respondentId: string) =>
      (list ?? [])
        .filter(r => r.respondent_student_id === respondentId)
        .map(r => {
          const friend = studentMap.get(r.target_student_id)
          const friendClass = classMap.get(r.target_student_id)
          return {
            id: r.target_student_id,
            first_name: friend?.first_name ?? "—",
            last_name: friend?.last_name ?? "—",
            target_class: friendClass ?? null,
            same_class: friendClass === myClass,
          }
        })

    const workChoices = mapChoices(workResponses, a.student_id)
    const emotionalChoices = mapChoices(emotionalResponses, a.student_id)
    const negativeChoices = mapChoices(negativeResponses, a.student_id)

    const hasAnyFriendInClass = friendChoices.some(f => f.same_class)

    return {
      student_id: a.student_id,
      first_name: s.first_name ?? "—",
      last_name: s.last_name ?? "—",
      current_class: s.current_class ?? "—",
      gender: s.gender ?? "—",
      target_class: myClass,
      friendship_choices: friendChoices,
      work_choices: workChoices,
      emotional_choices: emotionalChoices,
      negative_choices: negativeChoices,
      has_friend_in_class: hasAnyFriendInClass,
      answered_questionnaire:
        friendChoices.length > 0 || workChoices.length > 0 ||
        emotionalChoices.length > 0 || negativeChoices.length > 0,
    }
  })

  // Sort by class, then last name
  result.sort((a, b) => {
    if (a.target_class < b.target_class) return -1
    if (a.target_class > b.target_class) return 1
    return `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`, "es")
  })

  return NextResponse.json(result)
}
