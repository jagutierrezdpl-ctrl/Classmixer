import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, hasFullAccess, tutorCanAccessProcess, logAudit } from "@/lib/auth"
import { NextResponse } from "next/server"
import { calculateSociogram } from "@/lib/sociogram/calculate"
import { exportSociogramToExcel } from "@/lib/excel/export"
import { getQuestionCatalogIndex } from "@/lib/questionnaire/catalog"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params
  const supabase = createServiceClient()

  const { data: process } = await supabase
    .from("processes")
    .select("center_id")
    .eq("id", id)
    .single()

  if (!process || process.center_id !== profile.center_id) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  }
  if (!hasFullAccess(profile.role) && !(await tutorCanAccessProcess(profile.center_id, profile.id, id))) {
    return NextResponse.json({ error: "Sin acceso a este proceso" }, { status: 403 })
  }

  const [{ data: students }, { data: responses }] = await Promise.all([
    supabase.from("students").select("*").eq("process_id", id).eq("active", true),
    supabase.from("responses").select("*").eq("process_id", id),
  ])

  if (!students) return NextResponse.json({ error: "Error al cargar alumnos" }, { status: 500 })

  const catalogIndex = await getQuestionCatalogIndex(profile.center_id)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sociogramData = calculateSociogram(students as any, (responses ?? []) as any, catalogIndex.scoringRoles.friendshipLike)
  const buffer = exportSociogramToExcel(sociogramData)

  await logAudit(profile.id, profile.center_id, "export_sociogram_excel", "process", {
    processId: id,
    metadata: { students: students.length },
  })

  return new Response(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename=sociograma_metricas.xlsx",
    },
  })
}
