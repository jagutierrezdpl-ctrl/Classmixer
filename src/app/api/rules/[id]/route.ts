import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/auth"
import { NextResponse } from "next/server"

async function verifyRuleOwnership(supabase: ReturnType<typeof createServiceClient>, ruleId: string, centerId: string) {
  const { data } = await supabase
    .from("rules")
    .select("id, processes!inner(center_id)")
    .eq("id", ruleId)
    .single()
  if (!data) return false
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any).processes?.center_id === centerId
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const supabase = createServiceClient()

  if (!await verifyRuleOwnership(supabase, id, profile.center_id)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const { student_ids, ...ruleFields } = body

  const { data, error } = await supabase
    .from("rules")
    .update(ruleFields)
    .eq("id", id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // If student_ids provided, replace rule_students
  if (Array.isArray(student_ids)) {
    await supabase.from("rule_students").delete().eq("rule_id", id)
    if (student_ids.length > 0) {
      await supabase.from("rule_students").insert(
        student_ids.map((sid: string) => ({ rule_id: id, student_id: sid }))
      )
    }
  }

  return NextResponse.json(data)
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params
  const supabase = createServiceClient()

  if (!await verifyRuleOwnership(supabase, id, profile.center_id)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const { error } = await supabase.from("rules").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
