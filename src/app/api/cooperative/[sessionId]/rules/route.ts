/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, hasFullAccess, tutorCanAccessProcess, getTutorGroups } from "@/lib/auth"
import { NextResponse } from "next/server"

async function checkSessionAccess(sessionId: string, profile: NonNullable<Awaited<ReturnType<typeof getUserProfile>>>) {
  const supabase = createServiceClient()
  const { data: session } = await (supabase as any)
    .from("group_sessions")
    .select("id, class_name, process_id, processes!inner(center_id)")
    .eq("id", sessionId)
    .single()

  if (!session || session.processes?.center_id !== profile.center_id) return null

  if (!hasFullAccess(profile.role)) {
    if (profile.role === "tutor") {
      const tutorClasses = await getTutorGroups(profile.center_id, profile.id)
      if (!tutorClasses.includes(session.class_name)) return null
    } else {
      const ok = await tutorCanAccessProcess(profile.center_id, profile.id, session.process_id)
      if (!ok) return null
    }
  }
  return { supabase, session }
}

// GET — list rules for a session
export async function GET(_req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const { sessionId } = await params

  const access = await checkSessionAccess(sessionId, profile)
  if (!access) return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  const { supabase } = access

  const { data, error } = await (supabase as any)
    .from("cooperative_rules")
    .select("*, cooperative_rule_students(student_id, students(id, first_name, last_name))")
    .eq("session_id", sessionId)
    .eq("active", true)
    .order("created_at", { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST — create a rule
export async function POST(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const { sessionId } = await params

  const access = await checkSessionAccess(sessionId, profile)
  if (!access) return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  const { supabase } = access

  const body = await req.json()
  const { rule_type, student_ids, description } = body

  if (!["must_separate", "must_keep_together"].includes(rule_type)) {
    return NextResponse.json({ error: "rule_type inválido" }, { status: 400 })
  }
  if (!Array.isArray(student_ids) || student_ids.length < 2) {
    return NextResponse.json({ error: "Se necesitan al menos 2 alumnos" }, { status: 400 })
  }

  const { data: rule, error: ruleErr } = await (supabase as any)
    .from("cooperative_rules")
    .insert({ session_id: sessionId, rule_type, description: description ?? null, created_by: profile.id })
    .select()
    .single()

  if (ruleErr || !rule) return NextResponse.json({ error: ruleErr?.message ?? "Error" }, { status: 500 })

  await (supabase as any)
    .from("cooperative_rule_students")
    .insert(student_ids.map((sid: string) => ({ rule_id: rule.id, student_id: sid })))

  // Return rule with students
  const { data: full } = await (supabase as any)
    .from("cooperative_rules")
    .select("*, cooperative_rule_students(student_id, students(id, first_name, last_name))")
    .eq("id", rule.id)
    .single()

  return NextResponse.json(full)
}
