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
    .select("external_id, first_name, last_name, current_class, gender, academic_level, behavior_level, needs_type, observations")
    .eq("center_id", profile.center_id)
    .order("last_name")

  if (group) query = query.eq("current_class", group)

  const { data: students, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (students ?? []).map((s: any) => ({
    id_alumno:        s.external_id ?? "",
    nombre:           s.first_name,
    apellidos:        s.last_name,
    clase_actual:     s.current_class ?? "",
    genero:           s.gender ?? "",
    nivel_academico:  s.academic_level ?? "",
    conducta:         s.behavior_level ?? "",
    necesidades:      s.needs_type ?? "",
    nota_media:       "",   // to be filled in
    observaciones:    s.observations ?? "",
  }))

  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Alumnos")

  // Column widths
  ws["!cols"] = [
    { wch: 12 }, { wch: 16 }, { wch: 22 }, { wch: 12 },
    { wch: 8 },  { wch: 14 }, { wch: 14 }, { wch: 18 },
    { wch: 10 }, { wch: 30 },
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
