import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, logAudit } from "@/lib/auth"
import { NextResponse } from "next/server"
import * as XLSX from "xlsx"

const VALID_GENDERS  = ["F", "M", "Otro", "No especificado"]
const VALID_LEVELS   = ["Alto", "Medio-alto", "Medio", "Medio-bajo", "Bajo"]
const VALID_BEHAVIOR = ["Positiva", "Normal", "Seguimiento", "Conflictiva"]
const VALID_NEEDS    = ["No", "Sí", "ACNEAE", "NEE", "Refuerzo", "Altas capacidades", "Observación interna"]

function normalise(h: string) { return h.toLowerCase().trim().replace(/\s+/g, "_") }

function pick(row: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k] ?? row[k.replace(/_/g, " ")]
    if (v !== undefined && v !== "") return String(v).trim()
  }
  return ""
}

export async function POST(request: Request) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get("file") as File | null
  if (!file) return NextResponse.json({ error: "No se recibió archivo" }, { status: 400 })

  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: "array" })
  const sheetName = workbook.SheetNames.find(n =>
    n.toLowerCase().includes("alumno") || n.toLowerCase().includes("student")
  ) ?? workbook.SheetNames[0]

  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], { defval: "" })
  if (raw.length === 0) return NextResponse.json({ error: "El archivo está vacío" }, { status: 400 })

  const headers = Object.keys(raw[0]).map(normalise)
  const rows = raw.map(r => {
    const norm: Record<string, unknown> = {}
    Object.entries(r).forEach(([k, v]) => { norm[normalise(k)] = v })
    return norm
  })

  const upsertRows = rows.map(r => {
    const external_id     = pick(r, "id_alumno", "id", "external_id")
    const first_name      = pick(r, "nombre", "first_name")
    const last_name       = pick(r, "apellidos", "last_name")
    const current_class   = pick(r, "clase_actual", "clase", "current_class", "grupo")
    const gender_raw      = pick(r, "genero", "género", "gender")
    const gender          = VALID_GENDERS.includes(gender_raw) ? gender_raw : null
    const birth_year_raw  = pick(r, "año_nacimiento", "anyo_nacimiento", "birth_year", "nacimiento")
    const birth_year      = birth_year_raw ? parseInt(birth_year_raw) || null : null
    const academic_level_raw = pick(r, "nivel_academico", "nivel", "academic_level")
    const academic_level  = VALID_LEVELS.includes(academic_level_raw) ? academic_level_raw : null
    const behavior_raw    = pick(r, "conducta", "behavior_level", "comportamiento")
    const behavior_level  = VALID_BEHAVIOR.includes(behavior_raw) ? behavior_raw : null
    const needs_raw       = pick(r, "necesidades", "needs_type", "nee")
    const needs_type      = VALID_NEEDS.includes(needs_raw) ? needs_raw : null
    const observations    = pick(r, "observaciones", "observations", "notas")
    const school_year     = pick(r, "curso_escolar", "school_year", "curso")

    return {
      center_id: profile.center_id,
      external_id: external_id || null,
      first_name,
      last_name,
      current_class: current_class || null,
      gender,
      birth_year,
      academic_level,
      behavior_level,
      needs_type,
      observations: observations || null,
      school_year: school_year || null,
      updated_at: new Date().toISOString(),
    }
  }).filter(r => r.first_name && r.last_name)

  if (upsertRows.length === 0) {
    return NextResponse.json({ error: "No se encontraron filas con nombre y apellidos" }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Rows with external_id → upsert on (center_id, external_id)
  // Rows without external_id → upsert on (center_id, first_name, last_name) to avoid duplicates
  const withId    = upsertRows.filter(r => r.external_id)
  const withoutId = upsertRows.filter(r => !r.external_id)

  let upserted = 0

  for (let i = 0; i < withId.length; i += 100) {
    const batch = withId.slice(i, i + 100)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("student_profiles")
      .upsert(batch, { onConflict: "center_id,external_id", ignoreDuplicates: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    upserted += batch.length
  }

  for (let i = 0; i < withoutId.length; i += 100) {
    const batch = withoutId.slice(i, i + 100)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("student_profiles")
      .upsert(batch, { onConflict: "center_id,first_name,last_name", ignoreDuplicates: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    upserted += batch.length
  }

  await logAudit(profile.id, profile.center_id, "import_student_profiles", "student_profile", {
    metadata: { count: upserted, headers },
  })

  return NextResponse.json({ imported: upserted, total_rows: raw.length })
}
