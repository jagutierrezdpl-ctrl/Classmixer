import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, logAudit, canAccessProcess } from "@/lib/auth"
import { NextResponse } from "next/server"
import { createRuleSchema } from "@/schemas"

export async function POST(request: Request) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const body = await request.json()
  const parsed = createRuleSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { student_ids, tutor_id, ...ruleData } = parsed.data
  const { process_id } = body
  const metadata = ruleData.rule_type === "avoid_tutor" && tutor_id
    ? { tutor_id }
    : (body.metadata ?? undefined)

  if (!process_id) return NextResponse.json({ error: "process_id requerido" }, { status: 400 })

  const supabase = createServiceClient()

  // El proceso tiene que ser del centro y, para el profesorado, de sus grupos
  if (!(await canAccessProcess(profile, process_id))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rule, error } = await (supabase as any)
    .from("rules")
    .insert({ ...ruleData, process_id, created_by: profile.id, ...(metadata ? { metadata } : {}) })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Add rule students
  await supabase.from("rule_students").insert(
    student_ids.map((sid: string) => ({ rule_id: rule.id, student_id: sid }))
  )

  await logAudit(profile.id, profile.center_id, "create_rule", "rule", {
    processId: process_id,
    entityId: rule.id,
  })

  return NextResponse.json(rule, { status: 201 })
}
