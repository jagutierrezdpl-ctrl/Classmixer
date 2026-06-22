import { getUserProfile } from "@/lib/auth"
import ExcelJS from "exceljs"

const COURSE_CODES = "I3,I4,I5,1P,2P,3P,4P,5P,6P,1E,2E,3E,4E,1B,2B,1FP,2FP,1GM,2GM,1GS,2GS"
const LETTERS = "A,B,C,D,E"
const GENDERS = "F,M,Otro"

export async function GET(request: Request) {
  const profile = await getUserProfile()
  if (!profile) return new Response("No autorizado", { status: 401 })

  const { searchParams } = new URL(request.url)
  const group = searchParams.get("group")

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet("Alumnos")

  ws.columns = [
    { header: "nombre",        key: "nombre",    width: 16 },
    { header: "apellidos",     key: "apellidos", width: 22 },
    { header: "curso",         key: "curso",     width: 10 },
    { header: "letra",         key: "letra",     width: 8  },
    { header: "genero",        key: "genero",    width: 10 },
    { header: "nota_media",    key: "nota",      width: 12 },
    { header: "email",         key: "email",     width: 32 },
    { header: "observaciones", key: "obs",       width: 35 },
  ]

  ws.getRow(1).font = { bold: true }
  ws.getRow(1).fill = {
    type: "pattern", pattern: "solid",
    fgColor: { argb: "FFE8F4FD" },
  }

  // Example row only — the system generates IDs automatically
  const exampleCls = group ?? ""
  const exampleLetra = exampleCls.length > 0 ? exampleCls.slice(-1) : "A"
  const exampleCurso = exampleCls.length > 0 ? exampleCls.slice(0, -1) : "6P"
  ws.addRow({
    nombre: "María",
    apellidos: "García López",
    curso: exampleCurso,
    letra: exampleLetra,
    genero: "F",
    nota: 7.5,
    email: "maria.garcia@colegio.es",
    obs: "",
  })

  // Data validation dropdowns for rows 2–500
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dv = (ws as any).dataValidations
  // Columns: A=nombre, B=apellidos, C=curso, D=letra, E=genero, F=nota_media, G=email, H=observaciones
  dv.add("C2:C500", {
    type: "list", allowBlank: true, formulae: [`"${COURSE_CODES}"`],
    showErrorMessage: true, errorTitle: "Valor no válido",
    error: "Selecciona un código de curso del desplegable",
  })
  dv.add("D2:D500", {
    type: "list", allowBlank: true, formulae: [`"${LETTERS}"`],
    showErrorMessage: true, errorTitle: "Valor no válido",
    error: "Selecciona una letra del desplegable",
  })
  dv.add("E2:E500", {
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
