import { describe, it, expect } from "vitest"
import * as XLSX from "xlsx"
import { parseExcelImport } from "@/lib/excel/import"

// ── Helpers ───────────────────────────────────────────────────────────────────

type RowData = Record<string, string | number>

function makeExcelBuffer(rows: RowData[], sheetName = "Alumnos"): ArrayBuffer {
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" })
  return buf as ArrayBuffer
}

const VALID_ROW: RowData = {
  id_alumno: "A001",
  nombre: "Ana",
  apellidos: "García",
  clase_actual: "6A",
  genero: "F",
  nota_media: 7.5,
}

// ── Missing columns ───────────────────────────────────────────────────────────

describe("parseExcelImport — missing columns", () => {
  it("returns error when a required column is missing", () => {
    const buf = makeExcelBuffer([{ id_alumno: "A001", nombre: "Ana", apellidos: "García", clase_actual: "6A", genero: "F" }])
    const result = parseExcelImport(buf)
    expect(result.total).toBe(0)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors[0].message).toContain("nota_media")
  })

  it("returns error when multiple required columns are missing", () => {
    const buf = makeExcelBuffer([{ id_alumno: "A001" }])
    const result = parseExcelImport(buf)
    expect(result.errors[0].message).toContain("Faltan columnas obligatorias")
  })

  it("returns empty result for an empty sheet", () => {
    const buf = makeExcelBuffer([])
    const result = parseExcelImport(buf)
    expect(result.total).toBe(0)
    expect(result.rows).toHaveLength(0)
  })
})

// ── Valid rows ────────────────────────────────────────────────────────────────

describe("parseExcelImport — valid rows", () => {
  it("parses a single valid row correctly", () => {
    const buf = makeExcelBuffer([VALID_ROW])
    const result = parseExcelImport(buf)
    expect(result.total).toBe(1)
    expect(result.valid).toBe(1)
    expect(result.errors).toHaveLength(0)
    const row = result.rows[0]
    expect(row.external_id).toBe("A001")
    expect(row.first_name).toBe("Ana")
    expect(row.last_name).toBe("García")
    expect(row.current_class).toBe("6A")
    expect(row.gender).toBe("F")
    expect(row.average_grade).toBe(7.5)
    expect(row.status).toBe("valid")
  })

  it("infers academic_level from grade when not provided", () => {
    const buf = makeExcelBuffer([{ ...VALID_ROW, nota_media: 9 }])
    const result = parseExcelImport(buf)
    expect(result.rows[0].academic_level).toBe("Alto")
  })

  it("infers Medio-alto for grade 7.5", () => {
    const buf = makeExcelBuffer([VALID_ROW])
    const result = parseExcelImport(buf)
    expect(result.rows[0].academic_level).toBe("Medio-alto")
  })

  it("accepts comma as decimal separator in nota_media", () => {
    const buf = makeExcelBuffer([{ ...VALID_ROW, nota_media: "7,5" }])
    const result = parseExcelImport(buf)
    expect(result.rows[0].average_grade).toBe(7.5)
    expect(result.rows[0].status).toBe("valid")
  })

  it("computes gender distribution correctly", () => {
    const rows: RowData[] = [
      { ...VALID_ROW, id_alumno: "A001", genero: "F" },
      { ...VALID_ROW, id_alumno: "A002", genero: "M", nombre: "Luis" },
      { ...VALID_ROW, id_alumno: "A003", genero: "F", nombre: "Marta" },
    ]
    const buf = makeExcelBuffer(rows)
    const result = parseExcelImport(buf)
    expect(result.gender_distribution["F"]).toBe(2)
    expect(result.gender_distribution["M"]).toBe(1)
  })

  it("detects all classes", () => {
    const rows: RowData[] = [
      { ...VALID_ROW, id_alumno: "A001", clase_actual: "6A" },
      { ...VALID_ROW, id_alumno: "A002", clase_actual: "6B", nombre: "Luis" },
    ]
    const buf = makeExcelBuffer(rows)
    const result = parseExcelImport(buf)
    expect(result.detected_classes).toContain("6A")
    expect(result.detected_classes).toContain("6B")
  })
})

// ── Validation errors ─────────────────────────────────────────────────────────

describe("parseExcelImport — validation errors", () => {
  it("marks row as error when nota_media is not a number", () => {
    const buf = makeExcelBuffer([{ ...VALID_ROW, nota_media: "abc" }])
    const result = parseExcelImport(buf)
    expect(result.rows[0].status).toBe("error")
    expect(result.errors.some(e => e.field === "nota_media")).toBe(true)
  })

  it("allows missing id_alumno", () => {
    const buf = makeExcelBuffer([{ ...VALID_ROW, id_alumno: "" }])
    const result = parseExcelImport(buf)
    expect(result.rows[0].status).toBe("valid")
  })

  it("marks row as error when nombre is missing", () => {
    const buf = makeExcelBuffer([{ ...VALID_ROW, nombre: "" }])
    const result = parseExcelImport(buf)
    expect(result.rows[0].status).toBe("error")
  })

  it("marks row as error when clase_actual is missing", () => {
    const buf = makeExcelBuffer([{ ...VALID_ROW, clase_actual: "" }])
    const result = parseExcelImport(buf)
    expect(result.rows[0].status).toBe("error")
  })
})

// ── Warnings ──────────────────────────────────────────────────────────────────

describe("parseExcelImport — warnings", () => {
  it("warns on duplicate id_alumno", () => {
    const rows: RowData[] = [
      VALID_ROW,
      { ...VALID_ROW, nombre: "Otro" },
    ]
    const buf = makeExcelBuffer(rows)
    const result = parseExcelImport(buf)
    // Second row with same ID should be a warning (duplicate)
    expect(result.warnings.some(w => w.message.includes("duplicado"))).toBe(true)
  })

  it("warns on duplicate name+apellidos", () => {
    const rows: RowData[] = [
      VALID_ROW,
      { ...VALID_ROW, id_alumno: "A002" },
    ]
    const buf = makeExcelBuffer(rows)
    const result = parseExcelImport(buf)
    expect(result.warnings.some(w => w.message.includes("Posible duplicado"))).toBe(true)
  })

  it("warns on unrecognised gender and defaults to No especificado", () => {
    const buf = makeExcelBuffer([{ ...VALID_ROW, genero: "X" }])
    const result = parseExcelImport(buf)
    expect(result.warnings.some(w => w.field === "genero")).toBe(true)
    expect(result.rows[0].gender).toBe("No especificado")
    expect(result.rows[0].status).toBe("valid")
  })

  it("warns when nota_media is out of range but keeps row valid", () => {
    const buf = makeExcelBuffer([{ ...VALID_ROW, nota_media: 11 }])
    const result = parseExcelImport(buf)
    expect(result.warnings.some(w => w.field === "nota_media")).toBe(true)
    expect(result.rows[0].status).toBe("valid")
  })
})

// ── Summary stats ─────────────────────────────────────────────────────────────

describe("parseExcelImport — summary stats", () => {
  it("computes correct average_grade", () => {
    const rows: RowData[] = [
      { ...VALID_ROW, id_alumno: "A001", nota_media: 6 },
      { ...VALID_ROW, id_alumno: "A002", nota_media: 8, nombre: "Luis" },
    ]
    const buf = makeExcelBuffer(rows)
    const result = parseExcelImport(buf)
    expect(result.average_grade).toBeCloseTo(7, 1)
  })

  it("total equals number of data rows", () => {
    const rows: RowData[] = Array.from({ length: 5 }, (_, i) => ({
      ...VALID_ROW,
      id_alumno: `A00${i + 1}`,
      nombre: `Alumno${i}`,
    }))
    const buf = makeExcelBuffer(rows)
    const result = parseExcelImport(buf)
    expect(result.total).toBe(5)
  })
})
