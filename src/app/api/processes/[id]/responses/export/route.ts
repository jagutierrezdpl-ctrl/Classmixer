import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, hasFullAccess, tutorCanAccessProcess } from "@/lib/auth"
import { NextResponse } from "next/server"
import ExcelJS from "exceljs"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const supabase = createServiceClient()

  const { data: process } = await supabase
    .from("processes")
    .select("name, center_id")
    .eq("id", id)
    .eq("center_id", profile.center_id)
    .single()

  if (!process) return NextResponse.json({ error: "Proceso no encontrado" }, { status: 404 })
  if (!hasFullAccess(profile.role) && !(await tutorCanAccessProcess(profile.center_id, profile.id, id))) {
    return NextResponse.json({ error: "Sin acceso a este proceso" }, { status: 403 })
  }

  const [{ data: students }, { data: tokens }, { data: responsesRaw }] = await Promise.all([
    supabase.from("students").select("id, first_name, last_name, current_class").eq("process_id", id).eq("active", true).order("last_name"),
    supabase.from("questionnaire_tokens").select("student_id, used, completed_at").eq("process_id", id),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from("responses").select("respondent_student_id, target_student_id, relation_type, selection_order").eq("process_id", id),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const responses: any[] = (responsesRaw as any[]) ?? []
  const tokenMap = new Map((tokens ?? []).map(t => [t.student_id, t]))
  const studentMap = new Map((students ?? []).map(s => [s.id, s]))

  const workbook = new ExcelJS.Workbook()
  workbook.creator = "ClassMixer"

  // Sheet 1: Participation status
  const statusSheet = workbook.addWorksheet("Estado participación")
  statusSheet.columns = [
    { header: "Apellidos", key: "last_name", width: 22 },
    { header: "Nombre", key: "first_name", width: 18 },
    { header: "Clase", key: "class", width: 10 },
    { header: "Estado", key: "status", width: 18 },
    { header: "Completado", key: "completed_at", width: 22 },
  ]
  const h1 = statusSheet.getRow(1)
  h1.font = { bold: true, color: { argb: "FFFFFFFF" } }
  h1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E40AF" } }
  h1.height = 22

  for (const s of (students ?? [])) {
    const token = tokenMap.get(s.id)
    statusSheet.addRow({
      last_name: s.last_name,
      first_name: s.first_name,
      class: s.current_class,
      status: !token ? "Sin enlace" : token.used ? "Completado" : "Pendiente",
      completed_at: token?.completed_at
        ? new Date(token.completed_at).toLocaleString("es-ES")
        : "",
    })
  }

  // Sheet 2: All responses
  const respSheet = workbook.addWorksheet("Respuestas")
  respSheet.columns = [
    { header: "Alumno (apellidos, nombre)", key: "respondent", width: 30 },
    { header: "Clase origen", key: "respondent_class", width: 14 },
    { header: "Tipo relación", key: "relation_type", width: 18 },
    { header: "Orden elección", key: "order", width: 16 },
    { header: "Elegido (apellidos, nombre)", key: "target", width: 30 },
    { header: "Clase elegido", key: "target_class", width: 14 },
  ]
  const h2 = respSheet.getRow(1)
  h2.font = { bold: true, color: { argb: "FFFFFFFF" } }
  h2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E40AF" } }
  h2.height = 22

  const TYPE_LABELS: Record<string, string> = {
    friendship: "Amistad",
    work: "Trabajo",
    emotional: "Apoyo",
    negative: "Dificultad",
  }

  const sorted = [...(responses ?? [])].sort((a, b) => {
    const ra = studentMap.get(a.respondent_student_id)
    const rb = studentMap.get(b.respondent_student_id)
    const nameA = `${ra?.last_name} ${ra?.first_name}`.toLowerCase()
    const nameB = `${rb?.last_name} ${rb?.first_name}`.toLowerCase()
    if (nameA < nameB) return -1
    if (nameA > nameB) return 1
    return (a.selection_order ?? 0) - (b.selection_order ?? 0)
  })

  for (const r of sorted) {
    const respondent = studentMap.get(r.respondent_student_id)
    const target = studentMap.get(r.target_student_id)
    respSheet.addRow({
      respondent: respondent ? `${respondent.last_name}, ${respondent.first_name}` : r.respondent_student_id,
      respondent_class: respondent?.current_class ?? "",
      relation_type: TYPE_LABELS[r.relation_type] ?? r.relation_type,
      order: (r.selection_order ?? 0) + 1,
      target: target ? `${target.last_name}, ${target.first_name}` : r.target_student_id,
      target_class: target?.current_class ?? "",
    })
  }

  const buffer = await workbook.xlsx.writeBuffer()

  const safeName = (process.name ?? "respuestas").replace(/[^a-z0-9]/gi, "-").toLowerCase()

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="respuestas-${safeName}.xlsx"`,
    },
  })
}
