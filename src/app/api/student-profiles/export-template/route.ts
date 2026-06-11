import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/auth"
import { NextResponse } from "next/server"
import ExcelJS from "exceljs"

const COURSE_CODES = "I3,I4,I5,1P,2P,3P,4P,5P,6P,1E,2E,3E,4E,1B,2B,1FP,2FP,1GM,2GM,1GS,2GS"
const LETTERS = "A,B,C,D,E"
const GENDERS = "F,M,Otro"

export async function GET(request: Request) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const group = searchParams.get("group")

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

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet("Alumnos")

  // Column definitions
  ws.columns = [
    { header: "id_alumno",    key: "id",      width: 12 },
    { header: "nombre",       key: "nombre",  width: 16 },
    { header: "apellidos",    key: "apellidos", width: 22 },
    { header: "curso",        key: "curso",   width: 10 },
    { header: "letra",        key: "letra",   width: 8  },
    { header: "genero",       key: "genero",  width: 10 },
    { header: "nota_media",   key: "nota",    width: 12 },
    { header: "email",        key: "email",   width: 32 },
    { header: "observaciones", key: "obs",   width: 35 },
  ]

  // Header style
  ws.getRow(1).font = { bold: true }
  ws.getRow(1).fill = {
    type: "pattern", pattern: "solid",
    fgColor: { argb: "FFE8F4FD" },
  }

  // Data rows
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (students ?? []) as any[]
  if (rows.length > 0) {
    rows.forEach(s => {
      const cls = s.current_class ?? ""
      const letra = cls.length > 0 ? cls.slice(-1) : ""
      const curso = cls.length > 0 ? cls.slice(0, -1) : ""
      ws.addRow({
        id: s.external_id ?? "",
        nombre: s.first_name,
        apellidos: s.last_name,
        curso,
        letra,
        genero: s.gender ?? "",
        nota: "",
        email: s.email ?? "",
        obs: s.observations ?? "",
      })
    })
  } else {
    ws.addRow({
      id: "A001",
      nombre: "María",
      apellidos: "García López",
      curso: "6P",
      letra: "A",
      genero: "F",
      nota: 7.5,
      email: "maria.garcia@colegio.es",
      obs: "",
    })
  }

  // Data validation dropdowns for rows 2–500
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dv = (ws as any).dataValidations
  dv.add("D2:D500", {
    type: "list", allowBlank: true, formulae: [`"${COURSE_CODES}"`],
    showErrorMessage: true, errorTitle: "Valor no válido",
    error: "Selecciona un código de curso del desplegable",
  })
  dv.add("E2:E500", {
    type: "list", allowBlank: true, formulae: [`"${LETTERS}"`],
    showErrorMessage: true, errorTitle: "Valor no válido",
    error: "Selecciona una letra del desplegable",
  })
  dv.add("F2:F500", {
    type: "list", allowBlank: true, formulae: [`"${GENDERS}"`],
    showErrorMessage: true, errorTitle: "Valor no válido",
    error: "Selecciona F, M u Otro",
  })

  const buffer = await wb.xlsx.writeBuffer()
  const filename = group ? `plantilla_${group}.xlsx` : "plantilla_alumnos.xlsx"

  return new Response(buffer as unknown as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename=${filename}`,
    },
  })
}
