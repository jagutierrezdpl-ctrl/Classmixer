import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, logAudit } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (!["admin", "superadmin"].includes(profile.role)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 })
  }

  const { id } = await params
  const supabase = createServiceClient()

  // Load source process
  const { data: source } = await supabase
    .from("processes")
    .select("*")
    .eq("id", id)
    .eq("center_id", profile.center_id)
    .single()

  if (!source) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  // Create new process (reset status, remove dates)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { id: _id, created_at, updated_at, questionnaire_deadline, ...rest } = source as any
  const newProcess = {
    ...rest,
    name: `${source.name} (copia)`,
    status: "borrador",
    created_by: profile.id,
    questionnaire_deadline: null,
  }

  const { data: created, error: pErr } = await supabase
    .from("processes")
    .insert(newProcess)
    .select()
    .single()

  if (pErr || !created) {
    return NextResponse.json({ error: pErr?.message ?? "Error al crear proceso" }, { status: 500 })
  }

  const newId = created.id

  // Copy students (no tokens, no responses)
  const { data: students } = await supabase
    .from("students")
    .select("external_id, first_name, last_name, current_class, gender, average_grade, academic_level, behavior_level, needs_type, observations, student_profile_id")
    .eq("process_id", id)
    .eq("active", true)

  if (students && students.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await supabase.from("students").insert(students.map((s: any) => ({
      ...s,
      process_id: newId,
      active: true,
    })))
  }

  // Copy questionnaire settings
  const { data: qSettings } = await supabase
    .from("questionnaire_settings")
    .select("*")
    .eq("process_id", id)
    .maybeSingle()

  if (qSettings) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { id: _qid, process_id: _pid, created_at: _ca, ...qRest } = qSettings as any
    await supabase.from("questionnaire_settings").insert({ ...qRest, process_id: newId })
  }

  // Copy rules + rule_students
  const { data: rules } = await supabase
    .from("rules")
    .select("*, rule_students(*)")
    .eq("process_id", id)
    .eq("active", true)

  // We need the new student id mapping (old id → new id)
  const { data: oldStudents } = await supabase
    .from("students")
    .select("id, external_id, first_name, last_name")
    .eq("process_id", id)
    .eq("active", true)

  const { data: newStudents } = await supabase
    .from("students")
    .select("id, external_id, first_name, last_name")
    .eq("process_id", newId)
    .eq("active", true)

  // Build id mapping by external_id or name
  const oldMap = new Map((oldStudents ?? []).map(s => [s.id, s]))
  const newByKey = new Map((newStudents ?? []).map(s => [
    s.external_id ?? `${s.first_name} ${s.last_name}`.toLowerCase(),
    s.id,
  ]))

  function remapStudentId(oldId: string): string | null {
    const s = oldMap.get(oldId)
    if (!s) return null
    const key = s.external_id ?? `${s.first_name} ${s.last_name}`.toLowerCase()
    return newByKey.get(key) ?? null
  }

  for (const rule of (rules ?? [])) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { id: _rid, process_id: _pid, created_at: _ca, rule_students: rs, ...ruleRest } = rule as any
    const { data: newRule } = await supabase
      .from("rules")
      .insert({ ...ruleRest, process_id: newId })
      .select()
      .single()

    if (newRule && rs?.length) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const newRuleStudents = (rs as any[])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((rs: any) => {
          const newSid = remapStudentId(rs.student_id)
          if (!newSid) return null
          return { rule_id: newRule.id, student_id: newSid, role: rs.role }
        })
        .filter((x): x is { rule_id: string; student_id: string; role: string } => x !== null)

      if (newRuleStudents.length > 0) {
        await supabase.from("rule_students").insert(newRuleStudents)
      }
    }
  }

  await logAudit(profile.id, profile.center_id, "duplicate_process", "process", {
    processId: newId,
    metadata: { sourceId: id, students: students?.length ?? 0 },
  })

  return NextResponse.json({ id: newId, name: created.name })
}
