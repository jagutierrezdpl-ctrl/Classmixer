import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, hasFullAccess, tutorCanAccessProcess, logAudit } from "@/lib/auth"
import { NextResponse } from "next/server"
import * as XLSX from "xlsx"

const VALID_LEVELS    = ["Alto", "Medio-alto", "Medio", "Medio-bajo", "Bajo"]
const VALID_BEHAVIORS = ["Positiva", "Normal", "Seguimiento", "Conflictiva"]
const VALID_NEEDS     = ["No", "Sí", "ACNEAE", "NEE", "Refuerzo", "Altas capacidades", "Observación interna"]

function inferLevel(grade: number): string {
  if (grade >= 8.5) return "Alto"
  if (grade >= 7)   return "Medio-alto"
  if (grade >= 5.5) return "Medio"
  if (grade >= 4)   return "Medio-bajo"
  return "Bajo"
}

function normalizeKey(s: string) {
  return s.toLowerCase().trim().replace(/\s+/g, "_")
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params

  const ownerSupabase = createServiceClient()
  const { data: process } = await ownerSupabase
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parsed = raw.map((row: Record<string, any>) => {
    const r: Record<string, string> = {}
    for (const [k, v] of Object.entries(row)) r[normalizeKey(k)] = String(v).trim()
    return r
  })

  const hasId   = Object.keys(parsed[0]).includes("id_alumno")
  const hasName = Object.keys(parsed[0]).includes("nombre") && Object.keys(parsed[0]).includes("apellidos")
  if (!hasId && !hasName) {
    return NextResponse.json({ error: "El Excel debe tener id_alumno o nombre+apellidos" }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: existingStudents } = await supabase
    .from("students")
    .select("id, external_id, first_name, last_name, average_grade, academic_level, behavior_level, needs_type, observations")
    .eq("process_id", id)
    .eq("active", true)

  if (!existingStudents?.length) {
    return NextResponse.json({ error: "No hay alumnos en este proceso" }, { status: 400 })
  }

  const byExternalId = new Map(existingStudents.filter(s => s.external_id).map(s => [s.external_id!, s]))
  const byName       = new Map(existingStudents.map(s => [
    `${(s.first_name ?? "").toLowerCase()} ${(s.last_name ?? "").toLowerCase()}`.trim(),
    s,
  ]))

  type UpdateRow = {
    id: string
    name: string
    changes: Record<string, { from: unknown; to: unknown }>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    update: Record<string, any>
  }

  const updates: UpdateRow[] = []
  const unmatched: string[] = []

  for (const r of parsed) {
    let existing = r.id_alumno ? byExternalId.get(r.id_alumno) : undefined
    if (!existing && r.nombre && r.apellidos) {
      existing = byName.get(`${r.nombre.toLowerCase()} ${r.apellidos.toLowerCase()}`.trim())
    }
    if (!existing) {
      unmatched.push(r.id_alumno || `${r.nombre} ${r.apellidos}`.trim())
      continue
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const update: Record<string, any> = {}
    const changes: Record<string, { from: unknown; to: unknown }> = {}

    // nota_media
    if (r.nota_media !== "") {
      const grade = parseFloat(r.nota_media)
      if (!isNaN(grade) && grade >= 0 && grade <= 10) {
        if (grade !== existing.average_grade) {
          changes.nota_media = { from: existing.average_grade, to: grade }
          update.average_grade = grade
          // Auto-infer level unless explicitly provided
          if (!r.nivel_academico) {
            const newLevel = inferLevel(grade)
            if (newLevel !== existing.academic_level) {
              changes.nivel_academico = { from: existing.academic_level, to: newLevel }
              update.academic_level = newLevel
            }
          }
        }
      }
    }

    // nivel_academico (explicit override)
    if (r.nivel_academico !== "" && VALID_LEVELS.includes(r.nivel_academico)) {
      if (r.nivel_academico !== existing.academic_level) {
        changes.nivel_academico = { from: existing.academic_level, to: r.nivel_academico }
        update.academic_level = r.nivel_academico
      }
    }

    // conducta
    if (r.conducta !== "" && VALID_BEHAVIORS.includes(r.conducta)) {
      if (r.conducta !== existing.behavior_level) {
        changes.conducta = { from: existing.behavior_level, to: r.conducta }
        update.behavior_level = r.conducta
      }
    }

    // necesidades
    if (r.necesidades !== "" && VALID_NEEDS.includes(r.necesidades)) {
      if (r.necesidades !== existing.needs_type) {
        changes.necesidades = { from: existing.needs_type, to: r.necesidades }
        update.needs_type = r.necesidades
      }
    }

    // observaciones (allow empty to clear)
    if (r.observaciones !== undefined) {
      const newObs = r.observaciones === "" ? null : r.observaciones
      const oldObs = existing.observations ?? null
      if (newObs !== oldObs) {
        changes.observaciones = { from: oldObs, to: newObs }
        update.observations = newObs
      }
    }

    if (Object.keys(update).length > 0) {
      updates.push({
        id: existing.id,
        name: `${existing.first_name} ${existing.last_name}`,
        changes,
        update,
      })
    }
  }

  const unchanged = (existingStudents?.length ?? 0) - updates.length - unmatched.length

  if (action === "preview") {
    return NextResponse.json({
      total_rows: parsed.length,
      with_changes: updates.length,
      no_changes: unchanged,
      unmatched: unmatched.length,
      unmatched_list: unmatched.slice(0, 10),
      preview: updates.slice(0, 8).map(u => ({
        name: u.name,
        changes: u.changes,
      })),
    })
  }

  // confirm
  let updatedCount = 0
  for (const u of updates) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("students").update(u.update).eq("id", u.id)
    if (!error) updatedCount++
  }

  await logAudit(profile.id, profile.center_id, "bulk_update_students", "student", {
    processId: id,
    metadata: { updated: updatedCount, unmatched: unmatched.length },
  })

  return NextResponse.json({ updated: updatedCount, unmatched: unmatched.length })
}
