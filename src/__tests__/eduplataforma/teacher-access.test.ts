import { describe, it, expect, vi, beforeEach } from "vitest"
import { syncTeacherAccess } from "@/lib/eduplataforma/teacher-access"
import {
  getCenterInfo,
  getMembers,
  getTeacherSubjects,
  type EduplataformaMember,
  type EduplataformaTeacherAssignment,
} from "@/lib/eduplataforma/client"
import { FakeSupabase, type Row } from "../helpers/fake-supabase"

let db: FakeSupabase

vi.mock("@/lib/supabase/server", () => ({ createServiceClient: () => db }))
vi.mock("@/lib/eduplataforma/client", () => ({
  getCenterInfo: vi.fn(),
  getMembers: vi.fn(),
  getTeacherSubjects: vi.fn(),
}))

const CM_CENTER = "cm-center-1"
const OTHER_CM_CENTER = "cm-center-2"
const HUB_CENTER = "hub-center-1"
const YEAR = "2026/2027"

function teacher(id: string, email: string | null, over: Partial<EduplataformaMember> = {}): EduplataformaMember {
  return {
    id,
    type: "teacher",
    first_name: `Profe ${id}`,
    last_name: null,
    email,
    phone: null,
    group_name: null,
    subject: null,
    school_year: null,
    external_id: null,
    active: true,
    ...over,
  }
}

function assignment(teacherId: string | null, group: string | null, year = YEAR): EduplataformaTeacherAssignment {
  return { teacher_id: teacherId, group_name: group, school_year: year }
}

const account = (id: string, email: string, center = CM_CENTER): Row => ({ id, email, center_id: center, role: "tutor" })
const access = (userId: string, group: string, year = YEAR, center = CM_CENTER): Row => ({
  center_id: center,
  user_id: userId,
  group_name: group,
  school_year: year,
})

// Pares "cuenta|grupo|curso" del centro de ClassMixer, ordenados: lo que la tabla dice ahora mismo.
const stored = (center = CM_CENTER) =>
  db
    .rows("teacher_group_access")
    .filter((r) => r.center_id === center)
    .map((r) => `${r.user_id}|${r.group_name}|${r.school_year}`)
    .sort()

const run = (onlyEmail?: string) =>
  syncTeacherAccess({ classmixerCenterId: CM_CENTER, hubCenterId: HUB_CENTER, ...(onlyEmail ? { onlyEmail } : {}) })

beforeEach(() => {
  vi.clearAllMocks()
  db = new FakeSupabase()
  vi.mocked(getCenterInfo).mockResolvedValue({ id: HUB_CENTER, name: "Colegio", active_school_year: YEAR })
  vi.mocked(getMembers).mockResolvedValue([])
  vi.mocked(getTeacherSubjects).mockResolvedValue([])
})

describe("syncTeacherAccess — qué grupos se conceden", () => {
  it("cruza profesor del hub y cuenta de ClassMixer por email y concede solo los grupos que imparte", async () => {
    db.seed("users", [account("u-rosa", "rosa@centro.es"), account("u-luis", "luis@centro.es")])
    vi.mocked(getMembers).mockResolvedValue([teacher("t-rosa", "rosa@centro.es"), teacher("t-luis", "luis@centro.es")])
    vi.mocked(getTeacherSubjects).mockResolvedValue([
      assignment("t-rosa", "1º ESO A"),
      assignment("t-rosa", "1º ESO B"),
      assignment("t-rosa", "1º ESO A"), // otra materia del mismo grupo: una sola fila
      assignment("t-luis", "4º ESO A"),
    ])

    const result = await run()

    expect(stored()).toEqual([
      `u-luis|4º ESO A|${YEAR}`,
      `u-rosa|1º ESO A|${YEAR}`,
      `u-rosa|1º ESO B|${YEAR}`,
    ])
    expect(result).toEqual({ schoolYear: YEAR, users: 2, rows: 3, unmatched: 0 })
  })

  it("pide las asignaciones del curso activo del hub, no de otro", async () => {
    await run()

    expect(getTeacherSubjects).toHaveBeenCalledWith(HUB_CENTER, YEAR)
    expect(getMembers).toHaveBeenCalledWith(HUB_CENTER, { type: "teacher" })
  })

  it("compara los emails sin distinguir mayúsculas ni espacios", async () => {
    db.seed("users", [account("u-rosa", "rosa.perez@centro.es")])
    vi.mocked(getMembers).mockResolvedValue([teacher("t-rosa", "  Rosa.Perez@Centro.ES ")])
    vi.mocked(getTeacherSubjects).mockResolvedValue([assignment("t-rosa", "1º ESO A")])

    await run()

    expect(stored()).toEqual([`u-rosa|1º ESO A|${YEAR}`])
  })

  it("recorta los nombres de grupo y descarta los vacíos: se comparan por texto exacto con la ficha del alumno", async () => {
    db.seed("users", [account("u-rosa", "rosa@centro.es")])
    vi.mocked(getMembers).mockResolvedValue([teacher("t-rosa", "rosa@centro.es")])
    vi.mocked(getTeacherSubjects).mockResolvedValue([
      assignment("t-rosa", "  1º ESO A "),
      assignment("t-rosa", "1º ESO A"), // el mismo grupo sin espacios: una sola fila
      assignment("t-rosa", "   "),
      assignment("t-rosa", null),
    ])

    await run()

    expect(stored()).toEqual([`u-rosa|1º ESO A|${YEAR}`])
  })

  it("un profesor del hub sin cuenta en ClassMixer se cuenta como pendiente y no rompe nada", async () => {
    db.seed("users", [account("u-rosa", "rosa@centro.es")])
    vi.mocked(getMembers).mockResolvedValue([teacher("t-rosa", "rosa@centro.es"), teacher("t-nuevo", "nuevo@centro.es")])
    vi.mocked(getTeacherSubjects).mockResolvedValue([assignment("t-rosa", "1º ESO A"), assignment("t-nuevo", "2º ESO A")])

    const result = await run()

    expect(stored()).toEqual([`u-rosa|1º ESO A|${YEAR}`])
    expect(result).toMatchObject({ users: 1, rows: 1, unmatched: 1 })
  })

  it("ignora profesores inactivos, sin email o que no son profesores", async () => {
    db.seed("users", [account("u-a", "a@centro.es"), account("u-b", "b@centro.es"), account("u-c", "c@centro.es")])
    vi.mocked(getMembers).mockResolvedValue([
      teacher("t-a", "a@centro.es", { active: false }),
      teacher("t-b", null),
      teacher("t-c", "c@centro.es", { type: "pas" }),
    ])
    vi.mocked(getTeacherSubjects).mockResolvedValue([
      assignment("t-a", "1º ESO A"),
      assignment("t-b", "1º ESO A"),
      assignment("t-c", "1º ESO A"),
    ])

    const result = await run()

    expect(stored()).toEqual([])
    expect(result).toMatchObject({ users: 0, rows: 0, unmatched: 0 })
  })

  it("ignora asignaciones sin profesor o sin grupo y recorta el nombre del grupo", async () => {
    db.seed("users", [account("u-rosa", "rosa@centro.es")])
    vi.mocked(getMembers).mockResolvedValue([teacher("t-rosa", "rosa@centro.es")])
    vi.mocked(getTeacherSubjects).mockResolvedValue([
      assignment(null, "1º ESO A"),
      assignment("t-rosa", null),
      assignment("t-rosa", "   "),
      assignment("t-rosa", " 2º ESO B "),
      assignment("t-desconocido", "3º ESO A"),
    ])

    await run()

    expect(stored()).toEqual([`u-rosa|2º ESO B|${YEAR}`])
  })

  it("no mezcla cuentas de otro centro de ClassMixer aunque tengan el mismo email", async () => {
    db.seed("users", [account("u-rosa", "rosa@centro.es"), account("u-rosa-otro", "rosa@centro.es", OTHER_CM_CENTER)])
    vi.mocked(getMembers).mockResolvedValue([teacher("t-rosa", "rosa@centro.es")])
    vi.mocked(getTeacherSubjects).mockResolvedValue([assignment("t-rosa", "1º ESO A")])

    await run()

    expect(stored()).toEqual([`u-rosa|1º ESO A|${YEAR}`])
    expect(stored(OTHER_CM_CENTER)).toEqual([])
  })
})

describe("syncTeacherAccess — reconciliación", () => {
  it("retira el acceso a los grupos que el hub ya no asigna y a los de cursos anteriores", async () => {
    db.seed("users", [account("u-rosa", "rosa@centro.es")])
    db.seed("teacher_group_access", [
      access("u-rosa", "1º ESO A"), // sigue
      access("u-rosa", "1º ESO B"), // ya no lo da
      access("u-rosa", "4PA", "2025/2026"), // curso pasado
    ])
    vi.mocked(getMembers).mockResolvedValue([teacher("t-rosa", "rosa@centro.es")])
    vi.mocked(getTeacherSubjects).mockResolvedValue([assignment("t-rosa", "1º ESO A"), assignment("t-rosa", "2º ESO A")])

    await run()

    expect(stored()).toEqual([`u-rosa|1º ESO A|${YEAR}`, `u-rosa|2º ESO A|${YEAR}`])
  })

  it("al retirar el grupo de un curso anterior conserva el mismo grupo del curso actual", async () => {
    db.seed("users", [account("u-rosa", "rosa@centro.es")])
    db.seed("teacher_group_access", [access("u-rosa", "1º ESO A", "2025/2026"), access("u-rosa", "1º ESO A", YEAR)])
    vi.mocked(getMembers).mockResolvedValue([teacher("t-rosa", "rosa@centro.es")])
    vi.mocked(getTeacherSubjects).mockResolvedValue([assignment("t-rosa", "1º ESO A")])

    await run()

    expect(stored()).toEqual([`u-rosa|1º ESO A|${YEAR}`])
  })

  it("quita todo a quien deja de ser profesor activo del hub", async () => {
    db.seed("users", [account("u-rosa", "rosa@centro.es"), account("u-luis", "luis@centro.es")])
    db.seed("teacher_group_access", [access("u-rosa", "1º ESO A"), access("u-luis", "4º ESO A")])
    vi.mocked(getMembers).mockResolvedValue([teacher("t-luis", "luis@centro.es")])
    vi.mocked(getTeacherSubjects).mockResolvedValue([assignment("t-luis", "4º ESO A")])

    await run()

    expect(stored()).toEqual([`u-luis|4º ESO A|${YEAR}`])
  })

  it("no toca las filas de otro centro de ClassMixer", async () => {
    db.seed("users", [account("u-rosa", "rosa@centro.es")])
    db.seed("teacher_group_access", [access("u-otra", "1PA", YEAR, OTHER_CM_CENTER)])
    vi.mocked(getMembers).mockResolvedValue([teacher("t-rosa", "rosa@centro.es")])
    vi.mocked(getTeacherSubjects).mockResolvedValue([assignment("t-rosa", "1º ESO A")])

    await run()

    expect(stored(OTHER_CM_CENTER)).toEqual([`u-otra|1PA|${YEAR}`])
  })

  it("es idempotente: una segunda pasada no escribe nada", async () => {
    db.seed("users", [account("u-rosa", "rosa@centro.es")])
    vi.mocked(getMembers).mockResolvedValue([teacher("t-rosa", "rosa@centro.es")])
    vi.mocked(getTeacherSubjects).mockResolvedValue([assignment("t-rosa", "1º ESO A")])
    await run()
    db.log.length = 0

    await run()

    expect(db.ops("teacher_group_access", "upsert")).toHaveLength(0)
    expect(db.ops("teacher_group_access", "delete")).toHaveLength(0)
    expect(stored()).toEqual([`u-rosa|1º ESO A|${YEAR}`])
  })

  it("escribe en lotes de 500 y lee el estado actual por páginas de 1000", async () => {
    db.seed("users", [account("u-rosa", "rosa@centro.es")])
    vi.mocked(getMembers).mockResolvedValue([teacher("t-rosa", "rosa@centro.es")])
    vi.mocked(getTeacherSubjects).mockResolvedValue(
      Array.from({ length: 1100 }, (_, i) => assignment("t-rosa", `Grupo ${String(i).padStart(4, "0")}`))
    )

    await run()

    expect(db.ops("teacher_group_access", "upsert").map((o) => o.rows)).toEqual([500, 500, 100])
    expect(stored()).toHaveLength(1100)

    // Segunda pasada con 1100 filas ya guardadas: debe verlas TODAS (más de una página) para no reescribirlas.
    db.log.length = 0
    await run()
    expect(db.ops("teacher_group_access", "upsert")).toHaveLength(0)
    expect(db.ops("teacher_group_access", "select").length).toBeGreaterThanOrEqual(2)
  })

  it("borra en lotes cuando se retiran muchos grupos a la vez", async () => {
    db.seed("users", [account("u-rosa", "rosa@centro.es")])
    db.seed(
      "teacher_group_access",
      Array.from({ length: 1200 }, (_, i) => access("u-rosa", `Grupo ${String(i).padStart(4, "0")}`))
    )
    vi.mocked(getMembers).mockResolvedValue([teacher("t-rosa", "rosa@centro.es")])
    vi.mocked(getTeacherSubjects).mockResolvedValue([assignment("t-rosa", "Grupo 0000")])

    await run()

    expect(stored()).toEqual([`u-rosa|Grupo 0000|${YEAR}`])
    expect(db.ops("teacher_group_access", "delete")).toHaveLength(3) // 1199 bajas en lotes de 500
  })
})

describe("syncTeacherAccess — sin curso activo y fallos", () => {
  it("si el hub no tiene curso activo no toca la tabla", async () => {
    db.seed("users", [account("u-rosa", "rosa@centro.es")])
    db.seed("teacher_group_access", [access("u-rosa", "1º ESO A")])
    vi.mocked(getCenterInfo).mockResolvedValue({ id: HUB_CENTER, name: "Colegio", active_school_year: null })

    const result = await run()

    expect(result).toEqual({ schoolYear: null, users: 0, rows: 0, unmatched: 0 })
    expect(stored()).toEqual([`u-rosa|1º ESO A|${YEAR}`])
    expect(getTeacherSubjects).not.toHaveBeenCalled()
  })

  it.each([
    ["las asignaciones", () => vi.mocked(getTeacherSubjects).mockRejectedValue(new Error("hub 500"))],
    ["los profesores", () => vi.mocked(getMembers).mockRejectedValue(new Error("hub 500"))],
    ["el curso activo", () => vi.mocked(getCenterInfo).mockRejectedValue(new Error("hub 500"))],
  ])("si el hub falla al leer %s, lanza y conserva el acceso que ya había", async (_what, breakHub) => {
    db.seed("users", [account("u-rosa", "rosa@centro.es")])
    db.seed("teacher_group_access", [access("u-rosa", "1º ESO A")])
    breakHub()

    await expect(run()).rejects.toThrow("hub 500")

    expect(stored()).toEqual([`u-rosa|1º ESO A|${YEAR}`])
    expect(db.ops("teacher_group_access", "delete")).toHaveLength(0)
  })

  it("un error al leer las cuentas de ClassMixer lanza sin borrar nada", async () => {
    db.seed("teacher_group_access", [access("u-rosa", "1º ESO A")])
    db.failNext["users:select"] = { code: "XX000", message: "boom" }

    await expect(run()).rejects.toThrow("Acceso profesorado (usuarios): boom")

    expect(stored()).toEqual([`u-rosa|1º ESO A|${YEAR}`])
  })

  it("un error al dar de alta lanza y no llega a borrar", async () => {
    db.seed("users", [account("u-rosa", "rosa@centro.es")])
    db.seed("teacher_group_access", [access("u-rosa", "1º ESO B")])
    vi.mocked(getMembers).mockResolvedValue([teacher("t-rosa", "rosa@centro.es")])
    vi.mocked(getTeacherSubjects).mockResolvedValue([assignment("t-rosa", "1º ESO A")])
    db.failNext["teacher_group_access:upsert"] = { code: "XX000", message: "boom" }

    await expect(run()).rejects.toThrow("Acceso profesorado (alta): boom")

    expect(stored()).toEqual([`u-rosa|1º ESO B|${YEAR}`]) // no se revoca nada si no se pudo conceder lo nuevo
  })

  it("un error al leer el estado actual lanza con el prefijo de lectura", async () => {
    db.seed("users", [account("u-rosa", "rosa@centro.es")])
    db.failNext["teacher_group_access:select"] = { code: "42P01", message: "relation does not exist" }

    await expect(run()).rejects.toThrow("Acceso profesorado (lectura): relation does not exist")
  })

  it("un error al dar de baja lanza con el prefijo de baja", async () => {
    db.seed("users", [account("u-rosa", "rosa@centro.es")])
    db.seed("teacher_group_access", [access("u-rosa", "1º ESO B")])
    db.failNext["teacher_group_access:delete"] = { code: "XX000", message: "boom" }

    await expect(run()).rejects.toThrow("Acceso profesorado (baja): boom")
  })
})

describe("syncTeacherAccess — refresco de una sola persona (login)", () => {
  beforeEach(() => {
    db.seed("users", [account("u-rosa", "rosa@centro.es"), account("u-luis", "luis@centro.es")])
    vi.mocked(getMembers).mockResolvedValue([teacher("t-rosa", "rosa@centro.es"), teacher("t-luis", "luis@centro.es")])
  })

  it("actualiza solo a esa persona y deja intacto al resto", async () => {
    db.seed("teacher_group_access", [access("u-rosa", "1º ESO B"), access("u-luis", "4º ESO A")])
    vi.mocked(getTeacherSubjects).mockResolvedValue([
      assignment("t-rosa", "1º ESO A"),
      assignment("t-luis", "5º ESO A"), // Luis cambió en el hub, pero no es quien entra
    ])

    const result = await run("Rosa@Centro.es")

    expect(stored()).toEqual([`u-luis|4º ESO A|${YEAR}`, `u-rosa|1º ESO A|${YEAR}`])
    expect(result).toMatchObject({ users: 1, rows: 1 })
  })

  it("si ya no tiene asignaciones le quita el acceso", async () => {
    db.seed("teacher_group_access", [access("u-rosa", "1º ESO A"), access("u-luis", "4º ESO A")])
    vi.mocked(getTeacherSubjects).mockResolvedValue([assignment("t-luis", "4º ESO A")])

    await run("rosa@centro.es")

    expect(stored()).toEqual([`u-luis|4º ESO A|${YEAR}`])
  })

  it("si esa persona aún no tiene cuenta no escribe ni borra nada", async () => {
    db.seed("teacher_group_access", [access("u-luis", "4º ESO A")])
    vi.mocked(getMembers).mockResolvedValue([teacher("t-nuevo", "nuevo@centro.es")])
    vi.mocked(getTeacherSubjects).mockResolvedValue([assignment("t-nuevo", "2º ESO A")])

    const result = await run("nuevo@centro.es")

    expect(stored()).toEqual([`u-luis|4º ESO A|${YEAR}`])
    expect(result).toMatchObject({ users: 0, rows: 0, unmatched: 1 })
  })
})
