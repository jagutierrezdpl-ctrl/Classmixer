import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, logAudit } from "@/lib/auth"
import { NextResponse } from "next/server"
import * as XLSX from "xlsx"

function inferAcademicLevel(grade: number): string {
  if (grade >= 8.5) return "Alto"
  if (grade >= 7) return "Medio-alto"
  if (grade >= 5.5) return "Medio"
  if (grade >= 4) return "Medio-bajo"
  return "Bajo"
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params
  const url = new URL(request.url)
  const action = url.searchParams.get("action") ?? "preview"

  const formData = await request.formData()
  const file = formData.get("file") as File
  if (!file) return NextResponse.json({ error: "No se recibió archivo" }, { status: 400 })

  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: "array" })
  const sheetName = workbook.SheetNames.find(n =>
    n.toLowerCase().includes("alumno") || n.toLowerCase().includes("student")
  ) ?? workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" })

  if (raw.length === 0) return NextResponse.json({ error: "El archivo está vacío" }, { status: 400 })

  const headers = Object.keys(raw[0]).map(h => h.toLowerCase().trim().replace(/\s+/g, "_"))
  const hasGrade = headers.includes("nota_media")
  const hasId = headers.includes("id_alumno")
  const hasName = headers.includes("nombre") && headers.includes("apellidos")

  if (!hasGrade) return NextResponse.json({ error: "El Excel debe tener la columna nota_media" }, { status: 400 })
  if (!hasId && !hasName) return NextResponse.json({ error: "El Excel debe tener id_alumno o nombre+apellidos" }, { status: 400 })

  // Parse rows
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parsed = raw.map((row: Record<string, any>) => {
    const normalRow: Record<string, string> = {}
    for (const [k, v] of Object.entries(row)) {
      normalRow[k.toLowerCase().trim().replace(/\s+/g, "_")] = String(v).trim()
    }
    return {
      external_id: normalRow.id_alumno || null,
      first_name: normalRow.nombre || null,
      last_name: normalRow.apellidos || null,
      average_grade: parseFloat(normalRow.nota_media),
    }
  }).filter(r => !isNaN(r.average_grade) && r.average_grade >= 0 && r.average_grade <= 10)

  if (parsed.length === 0) return NextResponse.json({ error: "No se encontraron filas con nota válida" }, { status: 400 })

  const supabase = createServiceClient()

  // Fetch existing students for this process
  const { data: existingStudents } = await supabase
    .from("students")
    .select("id, external_id, first_name, last_name")
    .eq("process_id", id)
    .eq("active", true)

  if (!existingStudents || existingStudents.length === 0) {
    return NextResponse.json({ error: "No hay alumnos en este proceso" }, { status: 400 })
  }

  // Build lookup maps
  const byExternalId = new Map(existingStudents.filter(s => s.external_id).map(s => [s.external_id!, s.id]))
  const byName = new Map(existingStudents.map(s => [
    `${(s.first_name ?? "").toLowerCase().trim()} ${(s.last_name ?? "").toLowerCase().trim()}`,
    s.id,
  ]))

  // Match each parsed row to an existing student
  type UpdateMatch = { id: string; average_grade: number; academic_level: string; name: string }
  const updates: UpdateMatch[] = []
  const unmatched: string[] = []

  for (const r of parsed) {
    let studentId: string | undefined
    if (r.external_id) studentId = byExternalId.get(r.external_id)
    if (!studentId && r.first_name && r.last_name) {
      studentId = byName.get(`${r.first_name.toLowerCase()} ${r.last_name.toLowerCase()}`)
    }
    if (studentId) {
      updates.push({
        id: studentId,
        average_grade: r.average_grade,
        academic_level: inferAcademicLevel(r.average_grade),
        name: `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim(),
      })
    } else {
      unmatched.push(r.external_id ?? `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim())
    }
  }

  if (action === "preview") {
    return NextResponse.json({
      total: parsed.length,
      matched: updates.length,
      unmatched: unmatched.length,
      unmatched_list: unmatched.slice(0, 10),
      preview: updates.slice(0, 5).map(u => ({ name: u.name, grade: u.average_grade, level: u.academic_level })),
    })
  }

  // action === "confirm" — apply updates
  let updatedCount = 0
  for (const u of updates) {
    const { error } = await supabase
      .from("students")
      .update({ average_grade: u.average_grade, academic_level: u.academic_level })
      .eq("id", u.id)
    if (!error) updatedCount++
  }

  await logAudit(profile.id, profile.center_id, "update_grades", "student", {
    processId: id,
    metadata: { updated: updatedCount, unmatched: unmatched.length },
  })

  return NextResponse.json({ updated: updatedCount, unmatched: unmatched.length })
}
