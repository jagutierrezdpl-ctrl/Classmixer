/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, hasFullAccess, logAudit } from "@/lib/auth"
import { NextResponse } from "next/server"

const FLAG_THRESHOLD = 2

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile || !hasFullAccess(profile.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const { id } = await params
  const supabase = createServiceClient()

  const { data: process } = await supabase
    .from("processes")
    .select("id, center_id")
    .eq("id", id)
    .eq("center_id", profile.center_id)
    .single()

  if (!process) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  const { data: bullyingTypes } = await supabase
    .from("question_types")
    .select("code, label")
    .eq("category", "bullying")
    .eq("active", true)
    .or(`center_id.is.null,center_id.eq.${profile.center_id}`)

  const codes = (bullyingTypes ?? []).map((t: any) => t.code as string)

  const [{ data: students }, { data: responsesRaw }] = await Promise.all([
    supabase.from("students").select("id, first_name, last_name, current_class").eq("process_id", id).eq("active", true),
    codes.length > 0
      ? (supabase as any)
          .from("responses")
          .select("respondent_student_id, target_student_id, relation_type, metadata")
          .eq("process_id", id)
          .in("relation_type", codes)
      : Promise.resolve({ data: [] as any[] }),
  ])

  const studentMap = new Map((students ?? []).map((s: any) => [s.id, s]))
  const responses = (responsesRaw as any[]) ?? []

  const signalsByStudent = new Map<string, number>()

  const categories = (bullyingTypes ?? []).map((t: any) => {
    const ofType = responses.filter((r: any) => r.relation_type === t.code)
    const countByTarget = new Map<string, number>()
    for (const r of ofType) {
      countByTarget.set(r.target_student_id, (countByTarget.get(r.target_student_id) ?? 0) + 1)
      signalsByStudent.set(r.target_student_id, (signalsByStudent.get(r.target_student_id) ?? 0) + 1)
    }
    const topMentions = [...countByTarget.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([studentId, count]) => {
        const s = studentMap.get(studentId) as any
        return { name: s ? `${s.first_name} ${s.last_name}` : "Desconocido", current_class: s?.current_class ?? "", count }
      })
    return { code: t.code, label: t.label, total: ofType.length, topMentions }
  })

  const flagged = [...signalsByStudent.entries()]
    .filter(([, count]) => count >= FLAG_THRESHOLD)
    .sort((a, b) => b[1] - a[1])
    .map(([studentId, signals]) => {
      const s = studentMap.get(studentId) as any
      return { name: s ? `${s.first_name} ${s.last_name}` : "Desconocido", current_class: s?.current_class ?? "", signals }
    })

  await logAudit(profile.id, profile.center_id, "view_informe_convivencia", "process", {
    processId: id,
    metadata: { total_responses: responses.length, flagged_count: flagged.length },
  })

  return NextResponse.json({ totalResponses: responses.length, flagged, categories })
}
