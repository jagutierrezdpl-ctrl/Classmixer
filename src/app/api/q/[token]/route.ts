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
  const supabase = await createServiceClient()

  const { data: tokenData, error } = await supabase
    .from("questionnaire_tokens")
    .select("process_id, student_id, used")
    .eq("token", token)
    .single()

  if (error || !tokenData) {
    return NextResponse.json({ error: "Enlace no válido" }, { status: 404 })
  }
  if (tokenData.used) {
    return NextResponse.json({ error: "Ya completado" }, { status: 410 })
  }

  const { selections } = await request.json()

  if (!selections || typeof selections !== "object") {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })
  }

  // Build response rows
  const responseRows: { process_id: string; respondent_student_id: string; target_student_id: string; relation_type: string; weight: number }[] = []
  for (const [relationType, studentIds] of Object.entries(selections)) {
    if (!Array.isArray(studentIds)) continue
    for (const targetId of studentIds) {
      responseRows.push({
        process_id: tokenData.process_id,
        respondent_student_id: tokenData.student_id,
        target_student_id: targetId,
        relation_type: relationType,
        weight: 1,
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

  return NextResponse.json({ success: true })
}
