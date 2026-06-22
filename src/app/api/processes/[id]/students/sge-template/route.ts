import { getUserProfile } from "@/lib/auth"
import { NextResponse } from "next/server"
import { getSGETemplateHeaders, SGE_LABELS } from "@/lib/excel/sge-detector"
import type { SGEFormat } from "@/lib/excel/sge-detector"
import * as XLSX from "xlsx"

// GET /api/processes/[id]/students/sge-template?format=seneca
// Returns a downloadable XLSX file pre-filled with the correct headers for the requested SGE.
export async function GET(
  req: Request,
  { params: _params }: { params: Promise<{ id: string }> }
) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const url = new URL(req.url)
  const format = (url.searchParams.get("format") ?? "classmixer") as SGEFormat

  const headers = getSGETemplateHeaders(format)
  if (!headers.length) {
    return NextResponse.json({ error: "Formato no reconocido" }, { status: 400 })
  }

  // Build a sample XLSX with the headers + 3 example rows
  const exampleRows: Record<string, string>[] = [
    buildExampleRow(format, 1),
    buildExampleRow(format, 2),
    buildExampleRow(format, 3),
  ]

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(exampleRows, { header: headers })

  // Style header row
  const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1")
  for (let col = range.s.c; col <= range.e.c; col++) {
    const cellAddr = XLSX.utils.encode_cell({ r: 0, c: col })
    if (!ws[cellAddr]) continue
    ws[cellAddr].s = { font: { bold: true }, fill: { fgColor: { rgb: "E3F2FD" } } }
  }

  ws["!cols"] = headers.map(() => ({ wch: 20 }))

  XLSX.utils.book_append_sheet(wb, ws, "Alumnos")

  // Add instructions sheet
  const instructions = [
    ["ClassMixer — Plantilla de importación"],
    [`Formato: ${SGE_LABELS[format] ?? format}`],
    [""],
    ["INSTRUCCIONES:"],
    ["1. Rellena los datos de tus alumnos en la hoja 'Alumnos'"],
    ["2. Elimina las filas de ejemplo (filas 2-4)"],
    ["3. No modifiques los nombres de las columnas"],
    ["4. Sube el archivo en ClassMixer → Proceso → Alumnos → Importar"],
    [""],
    ["VALORES VÁLIDOS:"],
    ["Género (columna sexo/genero/gender): H/M (SÉNECA), M/F (inglés), Masculino/Femenino"],
    ["Nivel académico: Alto, Medio-alto, Medio, Medio-bajo, Bajo"],
    ["Conducta: Positiva, Normal, Seguimiento, Conflictiva"],
    ["Necesidades: No, Sí, NEE, ACNEAE, Refuerzo, Altas capacidades"],
  ]
  const wsInstr = XLSX.utils.aoa_to_sheet(instructions)
  wsInstr["!cols"] = [{ wch: 60 }]
  XLSX.utils.book_append_sheet(wb, wsInstr, "Instrucciones")

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="plantilla-${format}.xlsx"`,
    },
  })
}

function buildExampleRow(format: SGEFormat, n: number): Record<string, string> {
  const examples: Record<SGEFormat, Record<string, string>[]> = {
    seneca: [
      { nia: "12345678", "nombre del alumno": "Marta", "primer apellido": "García", "segundo apellido": "López", unidad: "6A", sexo: "M", "nota media": "8.5", "alumnado con nee": "No" },
      { nia: "23456789", "nombre del alumno": "Carlos", "primer apellido": "Martínez", "segundo apellido": "Ruiz", unidad: "6A", sexo: "H", "nota media": "7.2", "alumnado con nee": "No" },
      { nia: "34567890", "nombre del alumno": "Lucía", "primer apellido": "Fernández", "segundo apellido": "Gil", unidad: "6B", sexo: "M", "nota media": "9.1", "alumnado con nee": "Sí" },
    ],
    alexia: [
      { "codi alumne": "A001", nom: "Marta", cognoms: "García López", grup: "6A", gènere: "F", "nota mitja": "8.5", "email alumne": "marta@escola.cat" },
      { "codi alumne": "A002", nom: "Carlos", cognoms: "Martínez Ruiz", grup: "6A", gènere: "M", "nota mitja": "7.2", "email alumne": "carlos@escola.cat" },
      { "codi alumne": "A003", nom: "Lucía", cognoms: "Fernández Gil", grup: "6B", gènere: "F", "nota mitja": "9.1", "email alumne": "lucia@escola.cat" },
    ],
    clickedu: [
      { id_alumne: "A001", nom_alumne: "Marta", cognoms_alumne: "García López", curs: "6A", genere: "F", nota_final: "8.5", email: "marta@escola.cat" },
      { id_alumne: "A002", nom_alumne: "Carlos", cognoms_alumne: "Martínez Ruiz", curs: "6A", genere: "M", nota_final: "7.2", email: "carlos@escola.cat" },
      { id_alumne: "A003", nom_alumne: "Lucía", cognoms_alumne: "Fernández Gil", curs: "6B", genere: "F", nota_final: "9.1", email: "lucia@escola.cat" },
    ],
    raices: [
      { nia: "12345678", "nombre alumno": "Marta García López", "primer apellido": "García", unidad: "6A", sexo: "M", "nota media": "8.5", "fecha nacimiento": "01/01/2013" },
      { nia: "23456789", "nombre alumno": "Carlos Martínez Ruiz", "primer apellido": "Martínez", unidad: "6A", sexo: "H", "nota media": "7.2", "fecha nacimiento": "15/03/2013" },
      { nia: "34567890", "nombre alumno": "Lucía Fernández Gil", "primer apellido": "Fernández", unidad: "6B", sexo: "M", "nota media": "9.1", "fecha nacimiento": "22/07/2013" },
    ],
    idoceo: [
      { "student id": "A001", "first name": "Marta", "last name": "García López", group: "6A", gender: "Female", "average grade": "8.5", notes: "" },
      { "student id": "A002", "first name": "Carlos", "last name": "Martínez Ruiz", group: "6A", gender: "Male", "average grade": "7.2", notes: "" },
      { "student id": "A003", "first name": "Lucía", "last name": "Fernández Gil", group: "6B", gender: "Female", "average grade": "9.1", notes: "" },
    ],
    classmixer: [
      { id_alumno: "A001", nombre: "Marta", apellidos: "García López", clase_actual: "6A", genero: "F", nota_media: "8.5", nivel_academico: "Alto", conducta: "Normal", necesidades: "No", observaciones: "", tutor: "Juan Pérez", email: "marta@colegio.es" },
      { id_alumno: "A002", nombre: "Carlos", apellidos: "Martínez Ruiz", clase_actual: "6A", genero: "M", nota_media: "7.2", nivel_academico: "Medio", conducta: "Normal", necesidades: "No", observaciones: "", tutor: "Juan Pérez", email: "carlos@colegio.es" },
      { id_alumno: "A003", nombre: "Lucía", apellidos: "Fernández Gil", clase_actual: "6B", genero: "F", nota_media: "9.1", nivel_academico: "Alto", conducta: "Positiva", necesidades: "Altas capacidades", observaciones: "", tutor: "Ana García", email: "lucia@colegio.es" },
    ],
    generic: [],
  }

  return (examples[format] ?? [])[n - 1] ?? {}
}
