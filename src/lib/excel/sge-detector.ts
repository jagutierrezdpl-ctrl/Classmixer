// SGE format auto-detection and column normalization.
// Spanish school management systems (SGEs) each export student data with different column names.
// This module detects the format from header row and normalizes to our internal schema.

export type SGEFormat =
  | "seneca"      // SÉNECA (Andalucía) — CSV export
  | "alexia"      // Alexia — XLSX export
  | "clickedu"    // Clickedu (Cataluña) — XLSX export
  | "raices"      // RAÍCES (Madrid) — XLSX export
  | "idoceo"      // iDoceo export
  | "classmixer"  // Our own template
  | "generic"     // Unknown — use column mapping wizard

export interface ColumnMapping {
  id_alumno?: string
  nombre?: string
  apellidos?: string
  clase_actual?: string
  genero?: string
  nota_media?: string
  nivel_academico?: string
  conducta?: string
  necesidades?: string
  observaciones?: string
  tutor?: string
  email?: string
  fecha_nacimiento?: string
}

export interface SGEProfile {
  format: SGEFormat
  label: string
  confidence: number
  mapping: ColumnMapping
  genderMap?: Record<string, string>  // normalize gender values to F/M/Otro
  behaviorMap?: Record<string, string>
}

// Header fingerprints per SGE (lowercase, partial match)
const FINGERPRINTS: Record<SGEFormat, string[]> = {
  seneca:     ["nia", "nombre del alumno", "primer apellido", "segundo apellido", "unidad", "sexo"],
  alexia:     ["codi alumne", "nom", "cognoms", "grup", "gènere", "nota mitja"],
  clickedu:   ["id_alumne", "nom_alumne", "cognoms_alumne", "curs", "genere"],
  raices:     ["nia", "nombre alumno", "primer apellido", "unidad", "sexo", "fecha nacimiento"],
  idoceo:     ["student id", "first name", "last name", "group", "gender", "average grade"],
  classmixer: ["id_alumno", "nombre", "apellidos", "clase_actual", "genero", "nota_media"],
  generic:    [],
}

// Column mappings: sge_column → our_field
const MAPPINGS: Record<SGEFormat, ColumnMapping> = {
  seneca: {
    id_alumno:       "nia",
    nombre:          "nombre del alumno",
    apellidos:       "primer apellido",  // merge primer + segundo apellido on import
    clase_actual:    "unidad",
    genero:          "sexo",
    nota_media:      "nota media",
    necesidades:     "alumnado con nee",
    fecha_nacimiento: "fecha nacimiento",
  },
  alexia: {
    id_alumno:       "codi alumne",
    nombre:          "nom",
    apellidos:       "cognoms",
    clase_actual:    "grup",
    genero:          "gènere",
    nota_media:      "nota mitja",
    email:           "email alumne",
  },
  clickedu: {
    id_alumno:       "id_alumne",
    nombre:          "nom_alumne",
    apellidos:       "cognoms_alumne",
    clase_actual:    "curs",
    genero:          "genere",
    nota_media:      "nota_final",
    necesidades:     "nee",
    email:           "email",
  },
  raices: {
    id_alumno:       "nia",
    nombre:          "nombre alumno",
    apellidos:       "primer apellido",
    clase_actual:    "unidad",
    genero:          "sexo",
    nota_media:      "nota media",
    fecha_nacimiento: "fecha nacimiento",
  },
  idoceo: {
    id_alumno:       "student id",
    nombre:          "first name",
    apellidos:       "last name",
    clase_actual:    "group",
    genero:          "gender",
    nota_media:      "average grade",
    observaciones:   "notes",
  },
  classmixer: {
    id_alumno:       "id_alumno",
    nombre:          "nombre",
    apellidos:       "apellidos",
    clase_actual:    "clase_actual",
    genero:          "genero",
    nota_media:      "nota_media",
    nivel_academico: "nivel_academico",
    conducta:        "conducta",
    necesidades:     "necesidades",
    observaciones:   "observaciones",
    tutor:           "tutor",
    email:           "email",
  },
  generic: {},
}

// Gender value normalization per SGE
const GENDER_MAPS: Partial<Record<SGEFormat, Record<string, string>>> = {
  seneca:  { "h": "M", "m": "F", "hombre": "M", "mujer": "F" },
  raices:  { "h": "M", "m": "F", "hombre": "M", "mujer": "F" },
  alexia:  { "m": "M", "f": "F", "masculí": "M", "femení": "F" },
  clickedu:{ "m": "M", "f": "F", "home": "M", "dona": "F" },
  idoceo:  { "male": "M", "female": "F", "m": "M", "f": "F" },
}

export function detectSGEFormat(headers: string[]): SGEProfile {
  const normalized = headers.map(h => h.toLowerCase().trim())

  let bestFormat: SGEFormat = "generic"
  let bestScore = 0

  for (const [format, fingerprint] of Object.entries(FINGERPRINTS) as [SGEFormat, string[]][]) {
    if (format === "generic" || fingerprint.length === 0) continue
    const matches = fingerprint.filter(fp => normalized.some(h => h.includes(fp)))
    const score = matches.length / fingerprint.length
    if (score > bestScore) {
      bestScore = score
      bestFormat = format
    }
  }

  const confidence = bestScore
  const label = SGE_LABELS[bestFormat] ?? "Formato desconocido"

  return {
    format: bestFormat,
    label,
    confidence,
    mapping: MAPPINGS[bestFormat] ?? {},
    genderMap: GENDER_MAPS[bestFormat],
  }
}

const SGE_LABELS: Record<SGEFormat, string> = {
  seneca:     "SÉNECA (Junta de Andalucía)",
  alexia:     "Alexia",
  clickedu:   "Clickedu (catalán)",
  raices:     "RAÍCES (Comunidad de Madrid)",
  idoceo:     "iDoceo",
  classmixer: "Plantilla ClassMixer",
  generic:    "Formato personalizado",
}

export { SGE_LABELS }

// Given a row (key=original header, value=cell value) and a mapping, produce normalized row
export function normalizeRow(
  row: Record<string, string>,
  mapping: ColumnMapping,
  genderMap?: Record<string, string>,
): Record<string, string> {
  const result: Record<string, string> = {}
  const lowerRow = Object.fromEntries(Object.entries(row).map(([k, v]) => [k.toLowerCase().trim(), v]))

  for (const [ourField, sgeColumn] of Object.entries(mapping)) {
    if (!sgeColumn) continue
    const value = lowerRow[sgeColumn.toLowerCase()]
    if (value !== undefined) {
      if (ourField === "genero" && genderMap) {
        result[ourField] = genderMap[value.toLowerCase()] ?? value
      } else {
        result[ourField] = value
      }
    }
  }

  // SÉNECA + RAÍCES: merge primer + segundo apellido
  if (lowerRow["segundo apellido"] && result.apellidos) {
    result.apellidos = `${result.apellidos} ${lowerRow["segundo apellido"]}`.trim()
  }

  return result
}

// Generate a downloadable template buffer for a given SGE format
export function getSGETemplateHeaders(format: SGEFormat): string[] {
  const mapping = MAPPINGS[format]
  return Object.values(mapping).filter(Boolean) as string[]
}
