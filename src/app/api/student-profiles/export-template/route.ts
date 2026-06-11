import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/auth"
import { NextResponse } from "next/server"
import * as XLSX from "xlsx"

export async function GET(request: Request) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const group = searchParams.get("group") // optional filter by class

  const supabase = createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("student_profiles")
    .select("external_id, first_name, last_name, current_class, gender, email, observations")
    .eq("center_id", profile.center_id)
    .order("last_name")

  if (group) query = query.eq("current_class", group)

  const { data: students, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const HEADERS = [
    "id_alumno", "nombre", "apellidos", "clase_actual",
    "genero", "nota_media", "email", "observaciones",
  ]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dataRows = (students ?? []).map((s: any) => [
    s.external_id ?? "",
    s.first_name,
    s.last_name,
    s.current_class ?? "",
    s.gender ?? "",
    "",   // nota_media — to be filled in
    s.email ?? "",
    s.observations ?? "",
  ])

  // Always include headers; add one example row when no students exist
  const exampleRow = ["A001", "María", "García López", "6PA", "F", "7.5", "maria.garcia@colegio.es", ""]
  const aoa = [HEADERS, ...(dataRows.length > 0 ? dataRows : [exampleRow])]

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Alumnos")

  // Column widths: id_alumno, nombre, apellidos, clase_actual, genero, nota_media, email, observaciones
  ws["!cols"] = [
    { wch: 12 }, { wch: 16 }, { wch: 22 }, { wch: 12 },
    { wch: 8 },  { wch: 10 }, { wch: 30 }, { wch: 35 },
  ]

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })
  const filename = group ? `plantilla_${group}.xlsx` : "plantilla_alumnos.xlsx"

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename=${filename}`,
    },
  })
}
