import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { syncCenter, mapStaffRole } from "@/lib/eduplataforma/sync"
import { syncTeacherAccess } from "@/lib/eduplataforma/teacher-access"
import {
  getUsers,
  getMembers,
  getGroupMemberships,
  postMemberLink,
  type EduplataformaMember,
} from "@/lib/eduplataforma/client"

// ── Doble de Supabase en memoria ──────────────────────────────────────────────
// Reproduce lo que importa de PostgREST/Postgres para la sincronización: índices únicos
// (incluido student_profiles_name_unique), upsert por columnas de conflicto que solo pisa las
// columnas enviadas, lotes atómicos y un máximo de 1000 filas por lectura.

type Row = Record<string, unknown>
interface PgError {
  code: string
  message: string
}
interface Result {
  data: unknown
  error: PgError | null
}

const UNIQUES: Record<string, { name: string; cols: string[] }[]> = {
  student_profiles: [
    { name: "student_profiles_center_id_external_id_key", cols: ["center_id", "external_id"] },
    { name: "student_profiles_name_unique", cols: ["center_id", "first_name", "last_name"] },
  ],
  center_groups: [{ name: "center_groups_eduplataforma_group_unique", cols: ["center_id", "eduplataforma_group_id"] }],
  group_tutors: [{ name: "group_tutors_center_id_group_name_school_year_key", cols: ["center_id", "group_name", "school_year"] }],
  users: [{ name: "users_pkey", cols: ["id"] }],
}

class FakeDb {
  tables: Record<string, Row[]> = {}
  writes: { table: string; onConflict: string; rows: number }[] = []
  failWrites: Record<string, PgError> = {}
  private seq = 0

  auth = {
    admin: {
      createUser: async ({ email }: { email: string }) => ({ data: { user: { id: `auth-${email}` } }, error: null }),
      listUsers: async () => ({ data: { users: [] } }),
    },
  }

  from(table: string) {
    return new Query(this, table)
  }
  rows(table: string): Row[] {
    return (this.tables[table] ??= [])
  }
  nextId() {
    return `id-${++this.seq}`
  }
}

class Query implements PromiseLike<Result> {
  private op: "select" | "upsert" | "update" = "select"
  private filters: ((r: Row) => boolean)[] = []
  private payload: Row[] = []
  private patch: Row = {}
  private conflict: string[] = []
  private returning = false
  private cols = "*"
  private orderBy: string | null = null
  private window: [number, number] | null = null
  private mode: "many" | "single" | "maybe" = "many"

  constructor(
    private db: FakeDb,
    private table: string
  ) {}

  select(cols = "*") {
    this.returning = true
    this.cols = cols
    return this
  }
  eq(col: string, value: unknown) {
    this.filters.push((r) => r[col] === value)
    return this
  }
  order(col: string) {
    this.orderBy = col
    return this
  }
  range(from: number, to: number) {
    this.window = [from, to]
    return this
  }
  single() {
    this.mode = "single"
    return this
  }
  maybeSingle() {
    this.mode = "maybe"
    return this
  }
  upsert(rows: Row | Row[], opts: { onConflict?: string } = {}) {
    this.op = "upsert"
    this.payload = Array.isArray(rows) ? rows : [rows]
    this.conflict = (opts.onConflict ?? "").split(",").filter(Boolean)
    return this
  }
  update(patch: Row) {
    this.op = "update"
    this.patch = patch
    return this
  }

  then<R1 = Result, R2 = never>(
    onfulfilled?: ((value: Result) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null
  ): PromiseLike<R1 | R2> {
    return Promise.resolve(this.run()).then(onfulfilled, onrejected)
  }

  private project(row: Row): Row {
    if (this.cols === "*") return { ...row }
    const out: Row = {}
    for (const col of this.cols.split(",").map((c) => c.trim())) out[col] = row[col]
    return out
  }

  private shape(rows: Row[]): Result {
    const data = rows.map((r) => this.project(r))
    if (this.mode === "many") return { data, error: null }
    if (data.length === 1) return { data: data[0], error: null }
    if (data.length === 0 && this.mode === "maybe") return { data: null, error: null }
    return { data: null, error: { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" } }
  }

  private run(): Result {
    const { db, table } = this
    const stored = db.rows(table)

    if (this.op === "select") {
      let rows = stored.filter((r) => this.filters.every((f) => f(r)))
      const key = this.orderBy
      if (key) rows = [...rows].sort((a, b) => String(a[key]).localeCompare(String(b[key])))
      const [from, to] = this.window ?? [0, 999]
      return this.shape(rows.slice(from, Math.min(to, from + 999) + 1)) // PostgREST: máx. 1000 filas por petición
    }

    if (this.op === "update") {
      for (const row of stored) if (this.filters.every((f) => f(row))) Object.assign(row, this.patch)
      return { data: null, error: null }
    }

    db.writes.push({ table, onConflict: this.conflict.join(","), rows: this.payload.length })
    const injected = db.failWrites[table]
    if (injected) return { data: null, error: injected }

    // upsert atómico: el lote se aplica entero o no se aplica
    const next = stored.map((r) => ({ ...r }))
    const touched: Row[] = []
    for (const proposed of this.payload) {
      let target = this.conflict.length
        ? next.find((r) => this.conflict.every((c) => r[c] !== undefined && r[c] === proposed[c]))
        : undefined
      if (target) {
        Object.assign(target, proposed) // merge-duplicates: solo las columnas enviadas
      } else {
        target = { id: db.nextId(), active: true, ...proposed }
        next.push(target)
      }
      for (const def of UNIQUES[table] ?? []) {
        if (def.cols.some((c) => target[c] === null || target[c] === undefined)) continue
        const clash = next.find((r) => r !== target && def.cols.every((c) => r[c] === target[c]))
        if (clash) {
          return {
            data: null,
            error: { code: "23505", message: `duplicate key value violates unique constraint "${def.name}"` },
          }
        }
      }
      touched.push(target)
    }
    db.tables[table] = next
    return this.returning ? this.shape(touched) : { data: null, error: null }
  }
}

let db: FakeDb

vi.mock("@/lib/supabase/server", () => ({ createServiceClient: () => db }))
vi.mock("@/lib/eduplataforma/client", () => ({
  getUsers: vi.fn(),
  getMembers: vi.fn(),
  getGroupMemberships: vi.fn(),
  postMemberLink: vi.fn(),
}))
vi.mock("@/lib/eduplataforma/teacher-access", () => ({ syncTeacherAccess: vi.fn() }))

const TEACHER_ACCESS = { schoolYear: "2026/2027", users: 3, rows: 9, unmatched: 1 }

// ── Datos de prueba ───────────────────────────────────────────────────────────

const CM_CENTER = "cm-center-1"
const HUB_CENTER = "hub-center-1"

function student(i: number, over: Partial<EduplataformaMember> = {}): EduplataformaMember {
  return {
    id: `hub-${i}`,
    type: "student",
    first_name: `Nombre${i}`,
    last_name: `Apellido${i}`,
    email: null,
    phone: null,
    group_name: "1º ESO A",
    subject: null,
    school_year: "2026/2027",
    external_id: null,
    active: true,
    ...over,
  }
}

// Ficha importada a mano el curso pasado: external_id numérico del Excel, sin curso escolar.
function manualProfile(i: number, over: Row = {}): Row {
  return {
    id: `manual-${i}`,
    center_id: CM_CENTER,
    external_id: String(i).padStart(4, "0"),
    first_name: `Nombre${i}`,
    last_name: `Apellido${i}`,
    email: null,
    current_class: "6PA",
    school_year: null,
    gender: "F",
    academic_level: "alto",
    observations: "nota del curso pasado",
    active: true,
    ...over,
  }
}

const profiles = () => db.rows("student_profiles")
const lastSyncedAt = () => db.rows("centers")[0].last_synced_at
const profileWrites = () => db.writes.filter((w) => w.table === "student_profiles")

beforeEach(() => {
  vi.clearAllMocks()
  db = new FakeDb()
  db.rows("centers").push({ id: CM_CENTER, eduplataforma_center_id: HUB_CENTER, last_synced_at: null })
  vi.mocked(getUsers).mockResolvedValue([])
  vi.mocked(getMembers).mockResolvedValue([])
  vi.mocked(getGroupMemberships).mockResolvedValue([])
  vi.mocked(postMemberLink).mockResolvedValue(undefined as never)
  vi.mocked(syncTeacherAccess).mockResolvedValue(TEACHER_ACCESS)
  vi.spyOn(console, "info").mockImplementation(() => {})
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

// ── Alumnado ──────────────────────────────────────────────────────────────────

describe("syncCenter — alumnado", () => {
  it("crea las fichas de todo el alumnado del hub en pocos lotes y marca la sincronización", async () => {
    const hub = Array.from({ length: 450 }, (_, i) => student(i))
    vi.mocked(getMembers).mockResolvedValue(hub)

    const result = await syncCenter(CM_CENTER)

    expect(profiles()).toHaveLength(450)
    expect(new Set(profiles().map((p) => p.external_id))).toEqual(new Set(hub.map((m) => m.id)))
    expect(profiles()[0]).toMatchObject({ center_id: CM_CENTER, current_class: "1º ESO A", school_year: "2026/2027" })
    expect(result).toMatchObject({ students: 450, skipped: 0, linksPending: 0 })
    expect(lastSyncedAt()).toBeTruthy()
    // 450 alumnos en lotes de 200 = 3 escrituras (no una por alumno)
    expect(profileWrites()).toHaveLength(3)
  })

  it("adopta las fichas importadas a mano con el mismo nombre en vez de chocar con el índice único", async () => {
    // Caso real: 100 de las 103 fichas manuales del curso pasado tienen gemelo en el hub.
    profiles().push(manualProfile(0), manualProfile(1), manualProfile(2))
    vi.mocked(getMembers).mockResolvedValue([student(0), student(1), student(2), student(3)])

    const result = await syncCenter(CM_CENTER)

    expect(profiles()).toHaveLength(4) // 3 adoptadas + 1 nueva, sin duplicados
    const adopted = profiles().find((p) => p.id === "manual-1")
    expect(adopted).toMatchObject({
      external_id: "hub-1", // ahora enlazada con el alumno del hub
      current_class: "1º ESO A", // curso actual, no el de 6PA del curso pasado
      school_year: "2026/2027",
      // lo que ya había en la ficha se conserva
      gender: "F",
      academic_level: "alto",
      observations: "nota del curso pasado",
    })
    expect(result).toMatchObject({ students: 4, skipped: 0 })
    expect(lastSyncedAt()).toBeTruthy()
    // se avisa al hub de las 3 adoptadas (id de la ficha existente) y de la nueva
    expect(postMemberLink).toHaveBeenCalledTimes(4)
    expect(postMemberLink).toHaveBeenCalledWith(HUB_CENTER, { member_id: "hub-1", external_id: "manual-1" })
  })

  it("guarda el grupo sin espacios sobrantes (el acceso del profesorado compara texto exacto)", async () => {
    vi.mocked(getMembers).mockResolvedValue([
      student(1, { group_name: "  1º ESO A " }),
      student(2, { group_name: "   " }),
      student(3, { group_name: null }),
    ])

    await syncCenter(CM_CENTER)

    const byExternal = (id: string) => profiles().find((p) => p.external_id === id)
    expect(byExternal("hub-1")?.current_class).toBe("1º ESO A")
    expect(byExternal("hub-2")?.current_class).toBeNull()
    expect(byExternal("hub-3")?.current_class).toBeNull()
  })

  it("adopta también la ficha de un alumno que ya no figura en el hub", async () => {
    profiles().push(manualProfile(5, { external_id: "hub-antiguo" }))
    vi.mocked(getMembers).mockResolvedValue([student(5)])

    const result = await syncCenter(CM_CENTER)

    expect(profiles()).toHaveLength(1)
    expect(profiles()[0]).toMatchObject({ id: "manual-5", external_id: "hub-5" })
    expect(result.skipped).toBe(0)
  })

  it("una segunda sincronización no duplica nada ni vuelve a avisar al hub", async () => {
    vi.mocked(getMembers).mockResolvedValue([student(0), student(1), student(2)])
    await syncCenter(CM_CENTER)
    expect(postMemberLink).toHaveBeenCalledTimes(3)

    vi.mocked(postMemberLink).mockClear()
    db.writes = []
    const result = await syncCenter(CM_CENTER)

    expect(profiles()).toHaveLength(3)
    expect(result).toMatchObject({ students: 3, skipped: 0 })
    expect(postMemberLink).not.toHaveBeenCalled()
    expect(profileWrites().filter((w) => w.onConflict === "center_id,external_id")).toHaveLength(0)
  })

  it("lee todas las fichas existentes aunque haya más de 1000 (paginación)", async () => {
    vi.mocked(getMembers).mockResolvedValue(Array.from({ length: 1200 }, (_, i) => student(i)))
    await syncCenter(CM_CENTER)
    expect(profiles()).toHaveLength(1200)

    db.writes = []
    const result = await syncCenter(CM_CENTER)

    // si solo se leyeran 1000, 200 alumnos parecerían nuevos y chocarían con el índice único
    expect(result).toMatchObject({ students: 1200, skipped: 0 })
    expect(profileWrites().filter((w) => w.onConflict === "center_id,external_id")).toHaveLength(0)
  })

  it("omite a un alumno que no se puede guardar sin bloquear al resto ni la sincronización", async () => {
    const homonym = { first_name: "Ana", last_name: "López" }
    vi.mocked(getMembers).mockResolvedValue([student(1, homonym), student(2, homonym), student(3)])

    const result = await syncCenter(CM_CENTER)

    expect(profiles().map((p) => p.external_id).sort()).toEqual(["hub-1", "hub-3"])
    expect(result).toMatchObject({ students: 2, skipped: 1 })
    expect(lastSyncedAt()).toBeTruthy()
    // el log identifica al alumno por su id, nunca por su nombre
    const logged = vi.mocked(console.error).mock.calls.flat().join(" ")
    expect(logged).toContain("hub-2")
    expect(logged).not.toContain("López")
  })

  it("no adopta la ficha de otro alumno activo del hub (homónimo real)", async () => {
    profiles().push(manualProfile(1, { external_id: "hub-1", first_name: "Ana", last_name: "López" }))
    vi.mocked(getMembers).mockResolvedValue([
      student(1, { first_name: "Ana", last_name: "López" }),
      student(2, { first_name: "Ana", last_name: "López" }),
    ])

    const result = await syncCenter(CM_CENTER)

    expect(profiles()).toHaveLength(1)
    expect(profiles()[0]).toMatchObject({ id: "manual-1", external_id: "hub-1" }) // sigue siendo del alumno 1
    expect(result).toMatchObject({ students: 1, skipped: 1 })
  })

  it("no adopta la ficha de otro alumno del hub aunque su homónimo aparezca antes en el listado", async () => {
    profiles().push(manualProfile(1, { external_id: "hub-1", first_name: "Ana", last_name: "López" }))
    vi.mocked(getMembers).mockResolvedValue([
      student(2, { first_name: "Ana", last_name: "López" }), // el homónimo se procesa primero
      student(1, { first_name: "Ana", last_name: "López" }),
    ])

    const result = await syncCenter(CM_CENTER)

    expect(profiles()).toHaveLength(1)
    expect(profiles()[0]).toMatchObject({ id: "manual-1", external_id: "hub-1" })
    expect(result).toMatchObject({ students: 1, skipped: 1 })
  })

  it("si dos alumnos del hub compiten por la misma ficha manual, solo uno la adopta", async () => {
    profiles().push(manualProfile(1, { first_name: "Ana", last_name: "López" })) // external_id "0001"
    vi.mocked(getMembers).mockResolvedValue([
      student(1, { first_name: "Ana", last_name: "López" }),
      student(2, { first_name: "Ana", last_name: "López" }),
    ])

    const result = await syncCenter(CM_CENTER)

    expect(profiles()).toHaveLength(1)
    expect(profiles()[0]).toMatchObject({ id: "manual-1", external_id: "hub-1" })
    expect(result).toMatchObject({ students: 1, skipped: 1 })
  })

  it("un cambio de nombre en el hub puede liberar el nombre para un alumno nuevo", async () => {
    profiles().push(manualProfile(1, { external_id: "hub-1", first_name: "Ana", last_name: "López" }))
    vi.mocked(getMembers).mockResolvedValue([
      student(1, { first_name: "Ana María", last_name: "López" }), // renombrada
      student(2, { first_name: "Ana", last_name: "López" }), // alumna nueva con el nombre liberado
    ])

    const result = await syncCenter(CM_CENTER)

    expect(profiles()).toHaveLength(2)
    expect(result).toMatchObject({ students: 2, skipped: 0 })
  })

  it("conserva el email de la ficha si el hub no lo trae y usa el del hub si lo trae", async () => {
    profiles().push(manualProfile(0, { email: "manual0@centro.es" }), manualProfile(1, { email: "manual1@centro.es" }))
    vi.mocked(getMembers).mockResolvedValue([student(0), student(1, { email: "hub1@centro.es" })])

    await syncCenter(CM_CENTER)

    expect(profiles().find((p) => p.id === "manual-0")?.email).toBe("manual0@centro.es")
    expect(profiles().find((p) => p.id === "manual-1")?.email).toBe("hub1@centro.es")
  })

  it("no toca a los alumnos del hub de otro centro ni a los que ya no están en el hub", async () => {
    profiles().push(manualProfile(9, { external_id: "0009", first_name: "Sin", last_name: "Gemelo" }))
    vi.mocked(getMembers).mockResolvedValue([student(1)])

    await syncCenter(CM_CENTER)

    expect(profiles()).toHaveLength(2) // la sincronización no borra nada
    expect(profiles().find((p) => p.id === "manual-9")).toMatchObject({ external_id: "0009", current_class: "6PA" })
  })
})

describe("syncCenter — aviso al hub", () => {
  it("un fallo al avisar al hub no bloquea la sincronización", async () => {
    vi.mocked(getMembers).mockResolvedValue([student(0), student(1)])
    vi.mocked(postMemberLink).mockRejectedValue(new Error("hub caído"))

    const result = await syncCenter(CM_CENTER)

    expect(profiles()).toHaveLength(2)
    expect(result.students).toBe(2)
    expect(lastSyncedAt()).toBeTruthy()
  })

  it("respeta el tiempo máximo y marca la sincronización antes de avisar", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-09-20T10:00:00Z"))
    vi.mocked(getMembers).mockResolvedValue(Array.from({ length: 100 }, (_, i) => student(i)))
    const syncedWhenLinking: unknown[] = []
    vi.mocked(postMemberLink).mockImplementation(async () => {
      syncedWhenLinking.push(lastSyncedAt())
      vi.setSystemTime(Date.now() + 1000) // cada aviso tarda 1 s
    })

    const result = await syncCenter(CM_CENTER)

    expect(result.students).toBe(100)
    expect(result.linksPending).toBeGreaterThan(0)
    expect(vi.mocked(postMemberLink).mock.calls.length).toBeLessThan(100)
    expect(syncedWhenLinking.length).toBeGreaterThan(0)
    expect(syncedWhenLinking.every((v) => v !== null)).toBe(true)
  })
})

describe("syncCenter — errores", () => {
  it("un error que no es de datos (BD caída) aborta y no marca la sincronización", async () => {
    vi.mocked(getMembers).mockResolvedValue([student(0)])
    db.failWrites.student_profiles = { code: "57P01", message: "terminating connection due to administrator command" }

    await expect(syncCenter(CM_CENTER)).rejects.toThrow(/Sync alumnado/)
    expect(lastSyncedAt()).toBeNull()
  })

  it("un centro sin vínculo con EduPlataforma no consulta al hub", async () => {
    db.tables.centers = [{ id: CM_CENTER, eduplataforma_center_id: null }]

    const result = await syncCenter(CM_CENTER)

    expect(result).toEqual({ staff: 0, students: 0, groups: 0, skipped: 0, linksPending: 0, teacherAccess: null })
    expect(getMembers).not.toHaveBeenCalled()
    expect(syncTeacherAccess).not.toHaveBeenCalled()
  })
})

// ── Personal y grupos: comportamiento que no debe cambiar ─────────────────────

describe("syncCenter — personal y grupos", () => {
  it("sincroniza al personal con rol de ClassMixer y lo enlaza con su member del hub", async () => {
    vi.mocked(getUsers).mockResolvedValue([
      { id: "u1", name: "Marta", email: "marta@centro.es", role: "admin", secondary_roles: [] },
      { id: "u2", name: "Pau", email: "pau@centro.es", role: "teacher", secondary_roles: [] }, // sin rol en ClassMixer
    ])
    vi.mocked(getMembers).mockResolvedValue([
      student(0),
      student(50, { type: "staff", email: "marta@centro.es", first_name: "Marta", last_name: "X" }),
    ])

    const result = await syncCenter(CM_CENTER)

    expect(result.staff).toBe(1)
    expect(db.rows("users")).toHaveLength(1)
    expect(db.rows("users")[0]).toMatchObject({ email: "marta@centro.es", role: "admin", center_id: CM_CENTER })
    expect(postMemberLink).toHaveBeenCalledWith(HUB_CENTER, { member_id: "hub-50", external_id: "auth-marta@centro.es" })
  })

  it("crea los grupos del hub una sola vez cada uno", async () => {
    vi.mocked(getMembers).mockResolvedValue([student(0), student(1)])
    vi.mocked(getGroupMemberships).mockResolvedValue(
      ["hub-0", "hub-1"].map((member_id) => ({
        member_id,
        first_name: null,
        last_name: null,
        email: null,
        member_type: "student",
        group_id: "g1",
        group_name: "1º ESO A",
        role: "student",
        school_year: "2026/2027",
      }))
    )

    const result = await syncCenter(CM_CENTER)

    expect(result.groups).toBe(1)
    expect(db.rows("center_groups")).toHaveLength(1)
    expect(db.rows("center_groups")[0]).toMatchObject({ eduplataforma_group_id: "g1", name: "1º ESO A", school_year: "2026/2027" })
  })
})

// ── Acceso del profesorado ────────────────────────────────────────────────────

describe("syncCenter — acceso del profesorado", () => {
  it("lo sincroniza con el centro del hub, después de dar de alta al personal, y lo devuelve", async () => {
    vi.mocked(getUsers).mockResolvedValue([
      { id: "u1", name: "Rosa", email: "rosa@centro.es", role: "profesor", secondary_roles: [] },
    ])
    let usersWhenCalled = -1
    vi.mocked(syncTeacherAccess).mockImplementation(async () => {
      usersWhenCalled = db.rows("users").length
      return TEACHER_ACCESS
    })

    const result = await syncCenter(CM_CENTER)

    expect(syncTeacherAccess).toHaveBeenCalledTimes(1)
    expect(syncTeacherAccess).toHaveBeenCalledWith({ classmixerCenterId: CM_CENTER, hubCenterId: HUB_CENTER })
    expect(usersWhenCalled).toBe(1) // la cuenta de la profesora ya existe cuando se cruzan las asignaciones
    expect(result.teacherAccess).toEqual(TEACHER_ACCESS)
  })

  it("si falla no aborta: el alumnado se sincroniza, se deja el aviso en el log y no se declara sincronizado", async () => {
    vi.mocked(getMembers).mockResolvedValue([student(0), student(1)])
    vi.mocked(syncTeacherAccess).mockRejectedValue(new Error("hub caído"))

    const result = await syncCenter(CM_CENTER)

    expect(result.students).toBe(2)
    expect(result.teacherAccess).toBeNull()
    expect(lastSyncedAt()).not.toBeNull()
    expect(vi.mocked(console.error).mock.calls.flat().join(" ")).toContain("hub caído")
  })
})

describe("mapStaffRole", () => {
  it("el profesorado entra como tutor (único rol de ClassMixer con vista parcial del centro)", () => {
    expect(mapStaffRole("profesor", [])).toBe("tutor")
    expect(mapStaffRole("pas", ["profesor"])).toBe("tutor")
    expect(mapStaffRole("tutor", [])).toBe("tutor")
  })

  it("un rol con más alcance prevalece sobre el de profesor", () => {
    expect(mapStaffRole("profesor", ["orientador"])).toBe("orientador")
    expect(mapStaffRole("profesor", ["admin"])).toBe("admin")
    expect(mapStaffRole("director_general", ["profesor"])).toBe("admin")
  })

  it("el resto de roles sigue sin acceso", () => {
    for (const role of ["alumno", "familia", "pas", "superadmin", "foundation_admin", "jefe_estudios"]) {
      expect(mapStaffRole(role, [])).toBeNull()
    }
  })
})
