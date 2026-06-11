import { createServiceClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = await createServiceClient()

  const { data: tokenDataRaw, error } = await supabase
    .from("questionnaire_tokens")
    .select("*, students(*), processes(name, questionnaire_settings(*))")
    .eq("token", token)
    .single()

  if (error || !tokenDataRaw) {
    return NextResponse.json({ error: "Enlace no válido o expirado" }, { status: 404 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tokenData = tokenDataRaw as any

  if (tokenData.used) {
    return NextResponse.json({ error: "Este cuestionario ya ha sido completado" }, { status: 410 })
  }

  const student = tokenData.students
  const process = tokenData.processes
  const settings = process?.questionnaire_settings

  // Get all active students in the same process (excluding the respondent)
  const { data: allStudents } = await supabase
    .from("students")
    .select("id, first_name, last_name, current_class")
    .eq("process_id", tokenData.process_id)
    .eq("active", true)
    .neq("id", tokenData.student_id)
    .order("last_name")

  return NextResponse.json({
    student_name: `${student.first_name} ${student.last_name}`,
    process_name: process.name,
    settings: settings ?? {
      friendship_enabled: true,
      friendship_min: 1,
      friendship_max: 5,
      work_enabled: false,
      work_max: 3,
      work_min: 0,
      emotional_enabled: false,
      emotional_max: 3,
      emotional_min: 0,
      negative_enabled: false,
      negative_max: 2,
    },
    students: allStudents ?? [],
  })
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = createServiceClient()

  const { data: tokenDataRaw, error } = await supabase
    .from("questionnaire_tokens")
    .select("process_id, student_id, used, processes(questionnaire_settings(*))")
    .eq("token", token)
    .single()

  if (error || !tokenDataRaw) {
    return NextResponse.json({ error: "Enlace no válido" }, { status: 404 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tokenData = tokenDataRaw as any

  if (tokenData.used) {
    return NextResponse.json({ error: "Ya completado" }, { status: 410 })
  }

  const { selections } = await request.json()

  if (!selections || typeof selections !== "object") {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })
  }

  const settings = tokenData.processes?.questionnaire_settings ?? {}

  // Validate server-side limits per relation type
  const limits: Record<string, { enabled: boolean; max: number }> = {
    friendship: { enabled: settings.friendship_enabled ?? true,  max: settings.friendship_max ?? 5 },
    work:       { enabled: settings.work_enabled ?? false,       max: settings.work_max ?? 3 },
    emotional:  { enabled: settings.emotional_enabled ?? false,  max: settings.emotional_max ?? 3 },
    negative:   { enabled: settings.negative_enabled ?? false,   max: settings.negative_max ?? 2 },
  }

  // Fetch valid student IDs for this process (to prevent injecting arbitrary IDs)
  const { data: validStudents } = await supabase
    .from("students")
    .select("id")
    .eq("process_id", tokenData.process_id)
    .eq("active", true)
    .neq("id", tokenData.student_id)
  const validIds = new Set((validStudents ?? []).map((s: { id: string }) => s.id))

  // Build and validate response rows (cast as any[] because selection_order is a new column not yet in generated types)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const responseRows: any[] = []
  for (const [relationType, rawIds] of Object.entries(selections)) {
    if (!Array.isArray(rawIds)) continue
    const limit = limits[relationType]
    if (!limit?.enabled) continue // skip disabled question types
    const studentIds = (rawIds as string[])
      .filter(id => typeof id === "string" && validIds.has(id)) // only valid students
      .slice(0, limit.max) // enforce server-side max

    for (let i = 0; i < studentIds.length; i++) {
      const targetId = studentIds[i]
      if (targetId === tokenData.student_id) continue // can't choose yourself
      // weight = max - order (1st choice = max weight, last = 1)
      const selectionOrder = i + 1
      const weight = Math.max(1, limit.max - i)
      responseRows.push({
        process_id: tokenData.process_id,
        respondent_student_id: tokenData.student_id,
        target_student_id: targetId,
        relation_type: relationType,
        selection_order: selectionOrder,
        weight,
      })
    }
  }

  if (responseRows.length > 0) {
    const { error: insertError } = await supabase
      .from("responses")
      .insert(responseRows)

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }
  }

  // Mark token as used
  await supabase
    .from("questionnaire_tokens")
    .update({ used: true, completed_at: new Date().toISOString() })
    .eq("token", token)

  // Link to student_profile if not already linked
  // Ensures token-based responses are tracked historically, same as Google login
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: studentRow } = await (supabase as any)
    .from("students")
    .select("id, first_name, last_name, email, student_profile_id, processes!inner(center_id)")
    .eq("id", tokenData.student_id)
    .single()

  if (studentRow && !studentRow.student_profile_id) {
    const centerId = studentRow.processes?.center_id
    if (centerId) {
      let profileId: string | null = null

      // 1. Match by email — reliable even with duplicate names
      if (studentRow.email) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: byEmail } = await (supabase as any)
          .from("student_profiles")
          .select("id")
          .eq("center_id", centerId)
          .eq("email", studentRow.email)
          .maybeSingle()
        if (byEmail) profileId = byEmail.id
      }

      // 2. Fallback: match by name only if exactly one result (avoids wrong links with same-name students)
      if (!profileId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: byName } = await (supabase as any)
          .from("student_profiles")
          .select("id")
          .eq("center_id", centerId)
          .eq("first_name", studentRow.first_name)
          .eq("last_name", studentRow.last_name)
        if (byName?.length === 1) profileId = byName[0].id
      }

      if (profileId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("students")
          .update({ student_profile_id: profileId })
          .eq("id", tokenData.student_id)
      }
    }
  }

  return NextResponse.json({ success: true })
}
