import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/auth"
import { NextResponse } from "next/server"
import * as XLSX from "xlsx"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params
  const supabase = createServiceClient()

  const { data: process } = await supabase
    .from("processes")
    .select("name, center_id")
    .eq("id", id)
    .eq("center_id", profile.center_id)
    .single()

  if (!process) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  const { data: students } = await supabase
    .from("students")
    .select("external_id, first_name, last_name, current_class, gender, average_grade, academic_level, behavior_level, needs_type, observations")
    .eq("process_id", id)
    .eq("active", true)
    .order("last_name")
    .order("first_name")

  const rows = (students ?? []).map(s => ({
    id_alumno:       s.external_id ?? "",
    nombre:          s.first_name ?? "",
    apellidos:       s.last_name ?? "",
    clase_actual:    s.current_class ?? "",
    genero:          s.gender ?? "",
    nota_media:      s.average_grade ?? "",
    nivel_academico: s.academic_level ?? "",
    conducta:        s.behavior_level ?? "",
    necesidades:     s.needs_type ?? "",
    observaciones:   s.observations ?? "",
  }))

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)

  // Column widths
  ws["!cols"] = [
    { wch: 12 }, { wch: 16 }, { wch: 20 }, { wch: 12 },
    { wch: 8 },  { wch: 12 }, { wch: 14 }, { wch: 14 },
    { wch: 20 }, { wch: 30 },
  ]

  XLSX.utils.book_append_sheet(wb, ws, "Alumnos")

  // Instructions sheet
  const info = XLSX.utils.aoa_to_sheet([
    ["INSTRUCCIONES DE USO"],
    [""],
    ["Columnas que puedes modificar:", "nota_media, nivel_academico, conducta, necesidades, observaciones"],
    ["Columnas de solo lectura (se usan para identificar al alumno):", "id_alumno, nombre, apellidos, clase_actual, genero"],
    [""],
    ["Valores válidos para nivel_academico:", "Alto | Medio-alto | Medio | Medio-bajo | Bajo"],
    ["Valores válidos para conducta:", "Positiva | Normal | Seguimiento | Conflictiva"],
    ["Valores válidos para necesidades:", "No | Sí | ACNEAE | NEE | Refuerzo | Altas capacidades | Observación interna"],
    [""],
    ["Nota: Si dejas en blanco una celda, ese campo quedará vacío en la plataforma."],
  ])
  info["!cols"] = [{ wch: 50 }, { wch: 60 }]
  XLSX.utils.book_append_sheet(wb, info, "Instrucciones")

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })

  const safeName = process.name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40)

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="alumnos_${safeName}.xlsx"`,
    },
  })
}
