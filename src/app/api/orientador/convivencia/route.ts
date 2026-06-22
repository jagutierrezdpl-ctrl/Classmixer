/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function GET() {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (!["admin", "superadmin", "orientador"].includes(profile.role)) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 })
  }

  const supabase = createServiceClient()

  // Active processes for this center
  const { data: processes } = await supabase
    .from("processes")
    .select("id, name")
    .eq("center_id", profile.center_id)
    .not("status", "in", '("archivado")')
    .order("created_at", { ascending: false })
    .limit(10)

  if (!processes || processes.length === 0) {
    return NextResponse.json({ flagged: [], total_signals: 0, processes_checked: 0 })
  }

  const { data: bullyingTypes } = await supabase
    .from("question_types")
    .select("code, label")
    .eq("category", "bullying")
    .eq("active", true)
    .or(`center_id.is.null,center_id.eq.${profile.center_id}`)

  const codes = (bullyingTypes ?? []).map((t: any) => t.code as string)
  if (codes.length === 0) {
    return NextResponse.json({ flagged: [], total_signals: 0, processes_checked: processes.length })
  }

  const processIds = processes.map((p: any) => p.id)

  const [{ data: students }, { data: responsesRaw }] = await Promise.all([
    supabase
      .from("students")
      .select("id, first_name, last_name, current_class, process_id")
      .in("process_id", processIds)
      .eq("active", true),
    supabase
      .from("responses")
      .select("target_student_id, relation_type, process_id")
      .in("process_id", processIds)
      .in("relation_type", codes),
  ])

  const studentMap = new Map((students ?? []).map((s: any) => [s.id, s]))
  const processMap = new Map(processes.map((p: any) => [p.id, p]))
  const signalMap = new Map<string, { signals: number; process_id: string }>()

  for (const r of (responsesRaw ?? []) as any[]) {
    const key = `${r.process_id}:${r.target_student_id}`
    const existing = signalMap.get(key)
    signalMap.set(key, {
      signals: (existing?.signals ?? 0) + 1,
      process_id: r.process_id,
    })
  }

  const FLAG_THRESHOLD = 2
  const flagged = [...signalMap.entries()]
    .filter(([, v]) => v.signals >= FLAG_THRESHOLD)
    .sort((a, b) => b[1].signals - a[1].signals)
    .map(([key, v]) => {
      const studentId = key.split(":")[1]
      const s = studentMap.get(studentId) as any
      const proc = processMap.get(v.process_id) as any
      return {
        student_id: studentId,
        name: s ? `${s.first_name} ${s.last_name}` : "Desconocido",
        current_class: s?.current_class ?? "",
        process_id: v.process_id,
        process_name: proc?.name ?? "",
        signals: v.signals,
      }
    })

  return NextResponse.json({
    flagged,
    total_signals: (responsesRaw ?? []).length,
    processes_checked: processes.length,
  })
}
