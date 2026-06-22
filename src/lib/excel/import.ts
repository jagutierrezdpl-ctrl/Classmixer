import * as XLSX from "xlsx"
import type { ImportPreview, ImportRow, ImportError, ImportWarning } from "@/types"
import { detectSGEFormat, normalizeRow } from "./sge-detector"

const REQUIRED_COLUMNS = ["nombre", "apellidos", "clase_actual", "genero", "nota_media"]

const VALID_GENDERS = ["F", "M", "Otro", "No especificado"]
const VALID_LEVELS = ["Alto", "Medio-alto", "Medio", "Medio-bajo", "Bajo"]
const VALID_BEHAVIOR = ["Positiva", "Normal", "Seguimiento", "Conflictiva"]
const VALID_NEEDS = ["No", "Sí", "ACNEAE", "NEE", "Refuerzo", "Altas capacidades", "Observación interna"]

function inferAcademicLevel(grade: number): string {
  if (grade >= 8.5) return "Alto"
  if (grade >= 7) return "Medio-alto"
  if (grade >= 5.5) return "Medio"
  if (grade >= 4) return "Medio-bajo"
  return "Bajo"
}

export function parseExcelImport(buffer: ArrayBuffer): ImportPreview {
  const workbook = XLSX.read(buffer, { type: "array" })

  const sheetName = workbook.SheetNames.find(n =>
    n.toLowerCase().includes("alumno") || n.toLowerCase().includes("student")
  ) ?? workbook.SheetNames[0]

  const sheet = workbook.Sheets[sheetName]
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" })

  if (raw.length === 0) {
    return {
      total: 0, valid: 0, errors: [], warnings: [],
      detected_classes: [], gender_distribution: {},
      average_grade: 0, level_distribution: {}, rows: [],
    }
  }

  const originalHeaders = Object.keys(raw[0])
  const headers = originalHeaders.map(h => h.toLowerCase().trim().replace(/\s+/g, "_"))

  // Auto-detect SGE format and normalize columns if needed
  const sgeProfile = detectSGEFormat(originalHeaders)
  let processedRaw = raw as Record<string, string>[]
  let detectedFormat = sgeProfile.format

  if (sgeProfile.format !== "classmixer" && sgeProfile.format !== "generic" && sgeProfile.confidence > 0.4) {
    processedRaw = raw.map(row =>
      normalizeRow(row as Record<string, string>, sgeProfile.mapping, sgeProfile.genderMap)
    )
    detectedFormat = sgeProfile.format
  }

  const normalizedHeaders = processedRaw.length > 0
    ? Object.keys(processedRaw[0]).map(h => h.toLowerCase().trim())
    : headers

  const missingRequired = REQUIRED_COLUMNS.filter(c => !normalizedHeaders.includes(c))
  if (missingRequired.length > 0) {
    const hint = sgeProfile.format !== "generic" && sgeProfile.confidence < 0.4
      ? ` (ClassMixer detectó un posible formato ${sgeProfile.label} con ${Math.round(sgeProfile.confidence * 100)}% confianza)`
      : ""
    return {
      total: 0, valid: 0,
      errors: [{ row: 0, field: "columnas", message: `Faltan columnas obligatorias: ${missingRequired.join(", ")}${hint}` }],
      warnings: [], detected_classes: [], gender_distribution: {},
      average_grade: 0, level_distribution: {}, rows: [],
      sge_format: detectedFormat,
    }
  }

  const rows: ImportRow[] = []
  const errors: ImportError[] = []
  const warnings: ImportWarning[] = []
  const seenIds = new Set<string>()
  const seenNames = new Set<string>()

  for (let i = 0; i < processedRaw.length; i++) {
    const r = processedRaw[i]
    const rowNum = i + 2
    const rowErrors: string[] = []

    const normalize = (key: string) => {
      const found = Object.keys(r).find(k => k.toLowerCase().trim().replace(/\s+/g, "_") === key)
      return found ? String(r[found] ?? "").trim() : ""
    }

    const externalId = normalize("id_alumno")
    const firstName = normalize("nombre")
    const lastName = normalize("apellidos")
    const currentClass = normalize("clase_actual")
    const genderRaw = normalize("genero")
    const gradeRaw = normalize("nota_media")
    const academicLevel = normalize("nivel_academico")
    const behaviorLevel = normalize("conducta")
    const needsType = normalize("necesidades")
    const observations = normalize("observaciones")
    const tutor = normalize("tutor")
    const email = normalize("email").toLowerCase() || undefined

    if (externalId) {
      if (seenIds.has(externalId)) {
        warnings.push({ row: rowNum, field: "id_alumno", message: `ID duplicado: ${externalId}` })
      } else {
        seenIds.add(externalId)
      }
    }

    if (!firstName) {
      rowErrors.push("Falta nombre")
      errors.push({ row: rowNum, field: "nombre", message: "Falta el nombre" })
    }

    if (!currentClass) {
      rowErrors.push("Falta clase_actual")
      errors.push({ row: rowNum, field: "clase_actual", message: "Falta la clase actual" })
    }

    const nameKey = `${firstName.toLowerCase()}_${lastName.toLowerCase()}`
    if (firstName && lastName) {
      if (seenNames.has(nameKey)) {
        warnings.push({ row: rowNum, field: "nombre", message: `Posible duplicado: ${firstName} ${lastName}` })
      }
      seenNames.add(nameKey)
    }

    let gender = genderRaw
    if (!VALID_GENDERS.includes(genderRaw)) {
      if (!genderRaw) {
        gender = "No especificado"
        warnings.push({ row: rowNum, field: "genero", message: "Género no especificado, se usará 'No especificado'" })
      } else {
        warnings.push({ row: rowNum, field: "genero", message: `Género '${genderRaw}' no reconocido, se usará 'No especificado'` })
        gender = "No especificado"
      }
    }

    const grade = parseFloat(gradeRaw.replace(",", "."))
    if (isNaN(grade)) {
      rowErrors.push("nota_media no es numérica")
      errors.push({ row: rowNum, field: "nota_media", message: `Nota media '${gradeRaw}' no es un número válido` })
    } else if (grade < 0 || grade > 10) {
      warnings.push({ row: rowNum, field: "nota_media", message: `Nota media ${grade} fuera del rango 0-10` })
    }

    let finalLevel = academicLevel
    if (academicLevel && !VALID_LEVELS.includes(academicLevel)) {
      warnings.push({ row: rowNum, field: "nivel_academico", message: `Nivel '${academicLevel}' no reconocido` })
      finalLevel = ""
    }
    if (!finalLevel && !isNaN(grade)) {
      finalLevel = inferAcademicLevel(grade)
    }

    let finalBehavior = behaviorLevel
    if (behaviorLevel && !VALID_BEHAVIOR.includes(behaviorLevel)) {
      warnings.push({ row: rowNum, field: "conducta", message: `Conducta '${behaviorLevel}' no reconocida` })
      finalBehavior = ""
    }

    let finalNeeds = needsType
    if (needsType && !VALID_NEEDS.includes(needsType)) {
      warnings.push({ row: rowNum, field: "necesidades", message: `Necesidades '${needsType}' no reconocido` })
      finalNeeds = "No"
    }

    rows.push({
      row_number: rowNum,
      external_id: externalId,
      first_name: firstName,
      last_name: lastName,
      current_class: currentClass,
      gender: VALID_GENDERS.includes(gender) ? gender : "No especificado",
      average_grade: isNaN(grade) ? 0 : Math.min(10, Math.max(0, grade)),
      academic_level: finalLevel || undefined,
      behavior_level: VALID_BEHAVIOR.includes(finalBehavior) ? finalBehavior : undefined,
      needs_type: VALID_NEEDS.includes(finalNeeds) ? finalNeeds : undefined,
      observations: observations || undefined,
      tutor: tutor || undefined,
      email: email || undefined,
      status: rowErrors.length > 0 ? "error" : "valid",
      issues: rowErrors,
    })
  }

  const validRows = rows.filter(r => r.status === "valid")
  const classes = [...new Set(rows.map(r => r.current_class).filter(Boolean))].sort()

  const genderDist: Record<string, number> = {}
  const levelDist: Record<string, number> = {}
  let gradeSum = 0

  for (const row of validRows) {
    genderDist[row.gender] = (genderDist[row.gender] ?? 0) + 1
    if (row.academic_level) {
      levelDist[row.academic_level] = (levelDist[row.academic_level] ?? 0) + 1
    }
    gradeSum += row.average_grade
  }

  return {
    total: rows.length,
    valid: validRows.length,
    errors,
    warnings,
    detected_classes: classes,
    gender_distribution: genderDist,
    average_grade: validRows.length > 0 ? Math.round((gradeSum / validRows.length) * 100) / 100 : 0,
    level_distribution: levelDist,
    rows,
    sge_format: detectedFormat,
    sge_label: sgeProfile.label,
    sge_confidence: Math.round(sgeProfile.confidence * 100),
  }
}

export function generateTemplateExcel(): Buffer {
  const data = [
    {
      nombre: "Marta",
      apellidos: "García López",
      clase_actual: "6A",
      genero: "F",
      nota_media: 8.4,
      nivel_academico: "Alto",
      conducta: "Normal",
      necesidades: "No",
      observaciones: "",
      tutor: "María Pérez",
      email: "marta.garcia@tucolegio.es",
    },
    {
      nombre: "Lucas",
      apellidos: "Martínez Ruiz",
      clase_actual: "6B",
      genero: "M",
      nota_media: 6.2,
      nivel_academico: "Medio",
      conducta: "Normal",
      necesidades: "No",
      observaciones: "Conviene separar de alumno anterior",
      tutor: "Carlos Gómez",
      email: "lucas.martinez@tucolegio.es",
    },
  ]

  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Alumnos")

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer
}
