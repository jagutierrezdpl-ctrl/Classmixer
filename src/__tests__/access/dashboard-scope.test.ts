import { describe, it, expect, vi, beforeEach } from "vitest"
import { getUserProfile } from "@/lib/auth"
import DashboardPage from "@/app/(dashboard)/dashboard/page"
import AlertsPanel from "@/components/dashboard/AlertsPanel"
import { FakeSupabase, type LoggedOp } from "../helpers/fake-supabase"

// El panel de inicio agrega recuentos (cuestionarios abiertos, tokens pendientes, alumnado sin respuestas,
// propuestas…) de los procesos que consulta. Se lee con el cliente de servicio, así que si consulta todos
// los del centro un profesor ve cifras de clases que no son suyas. Se comprueba QUÉ procesos consulta.

let db: FakeSupabase

vi.mock("@/lib/supabase/server", () => ({ createServiceClient: () => db, createClient: vi.fn() }))
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND")
  }),
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT")
  }),
}))
vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>()
  return { ...actual, getUserProfile: vi.fn(), logAudit: vi.fn() }
})

const C1 = "c1"
const C2 = "c2"
type Profile = { id: string; center_id: string; role: string; name: string; email: string }
const profileOf = (id: string, role: string, center = C1): Profile => ({
  id,
  center_id: center,
  role,
  name: id,
  email: `${id}@centro.es`,
})

const ADMIN = profileOf("u-admin", "admin")
const ORIENTADOR = profileOf("u-orient", "orientador")
const ROSA = profileOf("u-rosa", "tutor") // tutoriza 4PA → solo p-propio
const NOEMI = profileOf("u-noemi", "tutor") // solo da clase en 6PA → p-ajeno
const SINCLASE = profileOf("u-sinclase", "tutor") // ni tutorías, ni docencia, ni asignaciones: ningún proceso
const ALUMNO = profileOf("u-alumno", "alumno")

const P_PROPIO = "p-propio"
const P_AJENO = "p-ajeno"
const P_ASIGNADO = "p-asignado"
const P_OTRO_CENTRO = "p-otro-centro"

const as = (p: Profile | null) => vi.mocked(getUserProfile).mockResolvedValue(p as never)

const reads = (table: string): LoggedOp[] => db.log.filter((l) => l.table === table && l.op === "select")
const processIdsQueried = (table: string, column: string) => reads(table).map((l) => l.inValues?.[column])
// Lecturas de `processes` acotadas a una lista de ids. (Para un profesor hay además una lectura sin
// acotar: la de la propia regla de acceso, que lee los procesos del centro para decidir cuáles le tocan.)
const scopedProcessLists = () => reads("processes").flatMap((l) => (l.inValues?.id ? [l.inValues.id] : []))

// Lee la página completa (lo que falle después de las consultas no importa: se comprueban las consultas).
const loadDashboard = () => DashboardPage().catch(() => undefined)

// Elementos de un tipo dentro del árbol que devuelve la página (sin renderizar los componentes).
type El = { type?: unknown; props?: Record<string, unknown> }
const findElements = (node: unknown, type: unknown): El[] => {
  if (Array.isArray(node)) return node.flatMap((n) => findElements(n, type))
  if (!node || typeof node !== "object") return []
  const el = node as El
  return [...(el.type === type ? [el] : []), ...findElements(el.props?.children, type)]
}
const alertsPanelProps = async () => findElements(await DashboardPage(), AlertsPanel).map((el) => el.props)

beforeEach(() => {
  vi.clearAllMocks()
  db = new FakeSupabase()
  db.seed("processes", [
    { id: P_PROPIO, center_id: C1, name: "Mezcla 4º", school_year: "2026-2027", status: "cuestionario_abierto", source_groups: ["4PA", "4PB"], created_at: "2026-09-02" },
    { id: P_AJENO, center_id: C1, name: "Mezcla 6º", school_year: "2026-2027", status: "cuestionario_abierto", source_groups: ["6PA"], created_at: "2026-09-03" },
    { id: P_ASIGNADO, center_id: C1, name: "Mezcla 5º", school_year: "2026-2027", status: "borrador", source_groups: ["5PA"], created_at: "2026-09-04" },
    { id: P_OTRO_CENTRO, center_id: C2, name: "Otro centro", school_year: "2026-2027", status: "cuestionario_abierto", source_groups: ["4PA"], created_at: "2026-09-05" },
  ])
  db.seed("group_tutors", [{ center_id: C1, user_id: ROSA.id, group_name: "4PA", school_year: "2026/2027" }])
  db.seed("teacher_group_access", [{ center_id: C1, user_id: NOEMI.id, group_name: "6PA", school_year: "2026/2027" }])
  db.seed("questionnaire_tokens", [
    { id: "t1", process_id: P_PROPIO, student_id: "e1", used: false },
    { id: "t2", process_id: P_AJENO, student_id: "e2", used: false },
  ])
  db.seed("students", [
    { id: "e1", process_id: P_PROPIO, active: true, email: null },
    { id: "e2", process_id: P_AJENO, active: true, email: null },
  ])
})

describe("panel de inicio: procesos que consulta", () => {
  it("un profesor consulta solo los procesos de sus tutorías, en todas las lecturas", async () => {
    as(ROSA)

    await loadDashboard()

    // lista de procesos y recuento de cuestionarios abiertos
    expect(scopedProcessLists()).toEqual([[P_PROPIO], [P_PROPIO]])
    // agregados por proceso: nunca un proceso ajeno
    for (const table of ["students", "questionnaire_tokens", "proposals", "sociogram_metrics"]) {
      const lists = processIdsQueried(table, "process_id")
      expect(lists.length, table).toBeGreaterThan(0)
      for (const list of lists) expect(list, table).toEqual([P_PROPIO])
    }
  })

  it("quien da clase en un grupo consulta el proceso de ese grupo", async () => {
    as(NOEMI)

    await loadDashboard()

    expect(scopedProcessLists()).toEqual([[P_AJENO], [P_AJENO]])
    for (const table of ["students", "questionnaire_tokens"]) {
      for (const list of processIdsQueried(table, "process_id")) expect(list, table).toEqual([P_AJENO])
    }
  })

  it("un profesor sin procesos no recibe los del centro por defecto (lista vacía ≠ sin filtro)", async () => {
    as(SINCLASE)

    await loadDashboard()

    expect(scopedProcessLists()).toEqual([[], []])
    for (const table of ["students", "questionnaire_tokens", "proposals"]) {
      for (const list of processIdsQueried(table, "process_id")) expect(list, table).toEqual(["__none__"])
    }
  })

  it.each([ADMIN, ORIENTADOR])("$role ve todo el centro: sin filtro por proceso en la lista", async (who) => {
    as(who)

    await loadDashboard()

    expect(reads("processes")).toHaveLength(2) // lista y recuento, sin la lectura de la regla de acceso
    expect(scopedProcessLists()).toEqual([])
    // y los agregados abarcan los procesos del centro (no los de otro centro)
    const lists = processIdsQueried("students", "process_id")
    expect(lists.length).toBeGreaterThan(0)
    for (const list of lists) expect([...(list ?? [])].sort()).toEqual([P_ASIGNADO, P_AJENO, P_PROPIO].sort())
  })

  it("el alumnado no consulta procesos", async () => {
    as(ALUMNO)

    await loadDashboard()

    expect(scopedProcessLists()).toEqual([[], []])
  })

  it("sin sesión redirige sin leer datos", async () => {
    as(null)

    await expect(DashboardPage()).rejects.toThrow("NEXT_REDIRECT")
    expect(db.log).toEqual([])
  })
})

describe("panel de inicio: qué procesos pasa al panel de alertas", () => {
  it("un profesor lo recibe acotado a sus procesos", async () => {
    as(ROSA)

    expect(await alertsPanelProps()).toEqual([{ centerId: C1, processIds: [P_PROPIO] }])
  })

  it("quien da clase en un grupo lo recibe acotado al proceso de ese grupo", async () => {
    as(NOEMI)

    expect(await alertsPanelProps()).toEqual([{ centerId: C1, processIds: [P_AJENO] }])
  })

  it("un profesor sin procesos recibe la lista vacía, no 'todos'", async () => {
    as(SINCLASE)

    expect(await alertsPanelProps()).toEqual([{ centerId: C1, processIds: [] }])
  })

  it.each([ADMIN, ORIENTADOR])("$role lo recibe sin acotar (todo el centro)", async (who) => {
    as(who)

    expect(await alertsPanelProps()).toEqual([{ centerId: C1, processIds: null }])
  })
})

describe("AlertsPanel: procesos que consulta", () => {
  it("con una lista de procesos solo mira esos y sus datos", async () => {
    await AlertsPanel({ centerId: C1, processIds: [P_PROPIO] })

    expect(processIdsQueried("processes", "id")).toEqual([[P_PROPIO]])
    for (const table of ["questionnaire_tokens", "students"]) {
      expect(processIdsQueried(table, "process_id"), table).toEqual([[P_PROPIO]])
    }
  })

  it("una lista vacía no muestra nada ni lee datos (no equivale a 'todos')", async () => {
    const out = await AlertsPanel({ centerId: C1, processIds: [] })

    expect(out).toBeNull()
    expect(processIdsQueried("processes", "id")).toEqual([[]])
    expect(reads("questionnaire_tokens")).toEqual([])
    expect(reads("students")).toEqual([])
  })

  it("sin lista (administración) mira los procesos abiertos del centro", async () => {
    await AlertsPanel({ centerId: C1, processIds: null })

    expect(processIdsQueried("processes", "id")).toEqual([undefined])
    const lists = processIdsQueried("questionnaire_tokens", "process_id")
    expect(lists).toHaveLength(1)
    expect([...(lists[0] ?? [])].sort()).toEqual([P_ASIGNADO, P_AJENO, P_PROPIO].sort())
  })
})
