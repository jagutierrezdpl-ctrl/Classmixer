import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/auth"
import { NextResponse } from "next/server"

async function verifyProposalOwner(supabase: ReturnType<typeof createServiceClient>, proposalId: string, centerId: string) {
  const { data } = await supabase
    .from("proposals")
    .select("id, process_id, processes!inner(center_id)")
    .eq("id", proposalId)
    .single()
  if (!data) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((data as any).processes?.center_id !== centerId) return null
  return data
}

// GET /api/proposals/[id]/tutors — list tutor assignments for this proposal
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params
  const supabase = createServiceClient()

  if (!await verifyProposalOwner(supabase, id, profile.center_id)) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("proposal_class_tutors")
    .select("*, users(id, name, email)")
    .eq("proposal_id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// PUT /api/proposals/[id]/tutors — upsert tutor for a class
// body: { target_class: "1ºA", user_id: "uuid" | null }
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params
  const supabase = createServiceClient()

  const proposal = await verifyProposalOwner(supabase, id, profile.center_id)
  if (!proposal) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  const { target_class, user_id } = await request.json()
  if (!target_class) return NextResponse.json({ error: "target_class requerido" }, { status: 400 })

  // If user_id is null, remove the assignment
  if (!user_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("proposal_class_tutors").delete().eq("proposal_id", id).eq("target_class", target_class)
    return NextResponse.json({ success: true })
  }

  // Verify tutor belongs to same center
  const { data: tutorProfile } = await supabase
    .from("users")
    .select("id, center_id")
    .eq("id", user_id)
    .eq("center_id", profile.center_id)
    .single()

  if (!tutorProfile) return NextResponse.json({ error: "Tutor no encontrado" }, { status: 404 })

  // Also check for avoid_tutor rules between any student in this class and this tutor
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const processId = (proposal as any).process_id
  const { data: assignments } = await supabase
    .from("proposal_assignments")
    .select("student_id")
    .eq("proposal_id", id)
    .eq("target_class", target_class)

  const studentIds = (assignments ?? []).map(a => a.student_id)

  // Find avoid_tutor rules for this tutor + any of these students
  const { data: conflictRules } = studentIds.length > 0
    ? await supabase
        .from("rules")
        .select("id, description, rule_students(student_id), metadata")
        .eq("process_id", processId)
        .eq("rule_type", "avoid_tutor")
        .eq("active", true)
    : { data: [] }

  const conflicts: string[] = []
  for (const rule of (conflictRules ?? [])) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = rule as any
    if (r.metadata?.tutor_id !== user_id) continue
    const ruleStudents: string[] = r.rule_students?.map((rs: { student_id: string }) => rs.student_id) ?? []
    const matched = ruleStudents.filter((sid: string) => studentIds.includes(sid))
    if (matched.length > 0) {
      conflicts.push(r.description ?? `Regla: ${matched.length} alumno(s) con restricción con este tutor`)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: saved, error } = await (supabase as any)
    .from("proposal_class_tutors")
    .upsert({ proposal_id: id, target_class, user_id }, { onConflict: "proposal_id,target_class" })
    .select("*, users(id, name, email)")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return NextResponse.json({ ...(saved as any), conflicts })
}
