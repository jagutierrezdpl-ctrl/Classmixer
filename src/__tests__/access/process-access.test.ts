import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  getUserProfile,
  canAccessProcess,
  getAccessibleProcessIds,
  canAccessGroupSession,
  tutorCanAccessProcess,
} from "@/lib/auth"
import { GET as historyGET } from "@/app/api/history/route"
import { GET as metricsGET } from "@/app/api/processes/[id]/sociogram/metrics/route"
import { GET as proposalGET, PATCH as proposalPATCH, DELETE as proposalDELETE } from "@/app/api/proposals/[id]/route"
import { GET as tutorsGET, PUT as tutorsPUT } from "@/app/api/proposals/[id]/tutors/route"
import { GET as exportGET } from "@/app/api/proposals/[id]/export/route"
import { GET as exportPdfGET } from "@/app/api/proposals/[id]/export/pdf/route"
import { POST as recalculatePOST } from "@/app/api/proposals/[id]/recalculate/route"
import { POST as rulesPOST } from "@/app/api/rules/route"
import { PATCH as rulePATCH, DELETE as ruleDELETE } from "@/app/api/rules/[id]/route"
import { GET as documentsGET } from "@/app/api/processes/[id]/documents/route"
import { GET as setGET, PATCH as setPATCH, DELETE as setDELETE } from "@/app/api/group-sets/[id]/route"
import { POST as approvePOST, DELETE as unapproveDELETE } from "@/app/api/group-sets/[id]/approve/route"
import { GET as importSourcesGET } from "@/app/api/processes/[id]/questionnaire/import-responses/route"
import { GET as notificationsGET } from "@/app/api/notifications/route"
import { FakeSupabase, type Row } from "../helpers/fake-supabase"

let db: FakeSupabase

vi.mock("@/lib/supabase/server", () => ({ createServiceClient: () => db, createClient: vi.fn() }))
vi.mock("next/navigation", () => ({ redirect: vi.fn() }))
// Ni el Excel ni el PDF se generan aquí: solo se comprueba que quien no tiene acceso no llega a ellos.
vi.mock("@/lib/excel/export", () => ({ exportProposalToExcel: vi.fn(() => Buffer.from("xlsx")) }))
vi.mock("@/lib/questionnaire/catalog", () => ({
  getQuestionCatalogIndex: vi.fn(async () => ({ excludedFromGraph: [] })),
}))
vi.mock("@react-pdf/renderer", () => ({
  Document: "Document",
  Page: "Page",
  Text: "Text",
  View: "View",
  Font: { register: vi.fn() },
  StyleSheet: { create: <T>(s: T) => s },
  renderToBuffer: vi.fn(async () => Buffer.from("pdf")),
}))
// La sesión se simula (getUserProfile); las reglas de acceso (canAccessProcess, getTutorGroups,
// hasFullAccess…) son las reales y leen del doble de Supabase.
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
const ROSA = profileOf("u-rosa", "tutor") // tutoriza 4PA; da clase en 1º ESO A
const LUIS = profileOf("u-luis", "tutor") // sin tutorías; asignado a mano al proceso p-asignado
const NOEMI = profileOf("u-noemi", "tutor") // solo da clase en 6PA (sin tutoría)
const TEO = profileOf("u-teo", "tutor") // solo da clase en 4PA (sin tutoría)
const SINCLASE = profileOf("u-sinclase", "tutor") // ni tutorías, ni docencia, ni asignaciones
const ALUMNO = profileOf("u-alumno", "alumno")
// Fue tutor y ahora tiene otro rol, pero conserva sus filas de tutoría y de asignación: el rol manda.
const EXTUTOR = profileOf("u-extutor", "alumno")
const ADMIN_C2 = profileOf("u-admin2", "admin", C2)

// Procesos: Rosa entra en p-propio (por su tutoría de 4PA) y en p-antiguo; no en p-ajeno.
const P_PROPIO = "p-propio" // grupos de origen 4PA, 4PB
const P_ANTIGUO = "p-antiguo" // curso anterior, grupo de origen 4PA
const P_AJENO = "p-ajeno" // grupo de origen 6PA
const P_ASIGNADO = "p-asignado" // grupo de origen 5PA, con LUIS en process_tutors
const P_OTRO_CENTRO = "p-otro-centro" // del centro c2, grupo de origen 4PA
const CENTER_OF: Record<string, string> = {
  [P_PROPIO]: C1,
  [P_ANTIGUO]: C1,
  [P_AJENO]: C1,
  [P_ASIGNADO]: C1,
  [P_OTRO_CENTRO]: C2,
}

const as = (p: Profile | null) => vi.mocked(getUserProfile).mockResolvedValue(p as never)
const params = <T extends object>(p: T) => ({ params: Promise.resolve(p) })
const req = (path: string, init?: RequestInit) => new Request(`http://localhost${path}`, init)
const jsonInit = (method: string, body: unknown) => ({
  method,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
})
const stored = (table: string, id: string) => db.rows(table).find((r) => r.id === id)
const ids = (rows: Row[]) => rows.map((r) => r.id).sort()

// Las relaciones embebidas (`processes!inner(center_id)`) las trae la propia fila sembrada.
const proposalRow = (id: string, processId: string, over: Row = {}): Row => ({
  id,
  process_id: processId,
  name: `Propuesta ${id}`,
  status: "borrador",
  processes: { center_id: CENTER_OF[processId] },
  ...over,
})
const ruleRow = (id: string, processId: string): Row => ({
  id,
  process_id: processId,
  rule_type: "must_separate",
  processes: { center_id: CENTER_OF[processId] },
})
const setRow = (id: string, processId: string, className: string | null, over: Row = {}): Row => ({
  id,
  session_id: `ses-${id}`,
  status: "generado",
  group_sessions: {
    process_id: processId,
    class_name: className,
    processes: { center_id: CENTER_OF[processId] },
  },
  ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  db = new FakeSupabase()
  db.seed("processes", [
    { id: P_PROPIO, center_id: C1, name: "Mezcla 4º", school_year: "2026-2027", status: "en_analisis", source_groups: ["4PA", "4PB"], created_at: "2026-09-02" },
    { id: P_ANTIGUO, center_id: C1, name: "Mezcla 4º anterior", school_year: "2025-2026", status: "cerrado", source_groups: ["4PA"], created_at: "2025-09-01" },
    { id: P_AJENO, center_id: C1, name: "Mezcla 6º", school_year: "2026-2027", status: "en_analisis", source_groups: ["6PA"], created_at: "2026-09-03" },
    { id: P_ASIGNADO, center_id: C1, name: "Mezcla 5º", school_year: "2026-2027", status: "borrador", source_groups: ["5PA"], created_at: "2026-09-04" },
    { id: P_OTRO_CENTRO, center_id: C2, name: "Otro centro", school_year: "2026-2027", status: "en_analisis", source_groups: ["4PA"], created_at: "2026-09-05" },
  ])
  db.seed("group_tutors", [
    { center_id: C1, user_id: ROSA.id, group_name: "4PA", school_year: "2026/2027" },
    { center_id: C2, user_id: ROSA.id, group_name: "4PA", school_year: "2026/2027" },
    { center_id: C1, user_id: EXTUTOR.id, group_name: "4PA", school_year: "2026/2027" },
  ])
  // La docencia (teacher_group_access, curso en formato del hub) da acceso al alumnado de sus clases
  // y a los procesos de esas clases del mismo curso escolar.
  db.seed("teacher_group_access", [
    { center_id: C1, user_id: ROSA.id, group_name: "1º ESO A", school_year: "2026/2027" },
    { center_id: C1, user_id: NOEMI.id, group_name: "6PA", school_year: "2026/2027" },
    { center_id: C1, user_id: TEO.id, group_name: "4PA", school_year: "2026/2027" },
    { center_id: C1, user_id: EXTUTOR.id, group_name: "6PA", school_year: "2026/2027" },
    { center_id: C2, user_id: ROSA.id, group_name: "6PA", school_year: "2026/2027" }, // docencia en otro centro: no cuenta aquí
  ])
  // Las cuentas (el rol de la fila manda para las rutas que no reciben el perfil).
  db.seed("users", [
    ...[ROSA, LUIS, NOEMI, TEO, SINCLASE].map((u) => ({ id: u.id, center_id: C1, role: "tutor" })),
    ...[ALUMNO, EXTUTOR].map((u) => ({ id: u.id, center_id: C1, role: "alumno" })),
  ])
  db.seed("process_tutors", [
    { id: "pt1", process_id: P_ASIGNADO, user_id: LUIS.id },
    { id: "pt2", process_id: P_OTRO_CENTRO, user_id: ROSA.id }, // fila incoherente: proceso de otro centro
    { id: "pt3", process_id: P_ASIGNADO, user_id: EXTUTOR.id },
  ])
  as(ROSA)
})

// ── Reglas de acceso (lib/auth) ──────────────────────────────────────────────

describe("canAccessProcess", () => {
  const can = (who: Profile, processId: string) => canAccessProcess(who as never, processId)

  it.each([ADMIN, ORIENTADOR])("$role entra en cualquier proceso de su centro", async (who) => {
    for (const id of [P_PROPIO, P_ANTIGUO, P_AJENO, P_ASIGNADO]) expect(await can(who, id)).toBe(true)
  })

  it("nadie entra en procesos de otro centro, ni con permisos completos", async () => {
    expect(await can(ADMIN, P_OTRO_CENTRO)).toBe(false)
    expect(await can(ADMIN_C2, P_PROPIO)).toBe(false)
    expect(await can(ADMIN_C2, P_OTRO_CENTRO)).toBe(true)
  })

  it("un proceso inexistente no es accesible", async () => {
    expect(await can(ADMIN, "no-existe")).toBe(false)
    expect(await can(ROSA, "no-existe")).toBe(false)
  })

  it("un profesor entra en los procesos cuyos grupos de origen tutoriza", async () => {
    expect(await can(ROSA, P_PROPIO)).toBe(true)
    expect(await can(ROSA, P_ANTIGUO)).toBe(true)
  })

  it("un profesor no entra en procesos de grupos que no tutoriza", async () => {
    expect(await can(ROSA, P_AJENO)).toBe(false)
    expect(await can(ROSA, P_ASIGNADO)).toBe(false)
  })

  it("una asignación explícita al proceso (process_tutors) también da acceso", async () => {
    expect(await can(LUIS, P_ASIGNADO)).toBe(true)
    expect(await can(LUIS, P_PROPIO)).toBe(false)
  })

  it("un profesor entra en los procesos de los grupos en los que da clase", async () => {
    expect(await can(NOEMI, P_AJENO)).toBe(true) // da clase en 6PA
    expect(await can(TEO, P_PROPIO)).toBe(true) // da clase en 4PA, uno de los grupos de origen
  })

  it("dar clase en otro grupo no abre el proceso", async () => {
    expect(await can(NOEMI, P_PROPIO)).toBe(false)
    expect(await can(TEO, P_AJENO)).toBe(false)
    expect(await can(TEO, P_ASIGNADO)).toBe(false)
  })

  it("un grupo con el mismo nombre de otro curso escolar es otra cohorte: no abre el proceso anterior", async () => {
    expect(await can(TEO, P_ANTIGUO)).toBe(false) // p-antiguo es de 2025-2026 y tiene 4PA de origen
  })

  it("el curso escolar se compara entre formatos (2026/2027 del hub = 2026-2027) y en los dos sentidos", async () => {
    db.rows("teacher_group_access").push({ center_id: C1, user_id: SINCLASE.id, group_name: "4PA", school_year: "2025/2026" })

    expect(await can(SINCLASE, P_ANTIGUO)).toBe(true)
    expect(await can(SINCLASE, P_PROPIO)).toBe(false)
  })

  it("los espacios en el curso escolar no cuentan ('2026 / 2027')", async () => {
    db.rows("teacher_group_access").push({ center_id: C1, user_id: SINCLASE.id, group_name: "4PA", school_year: " 2026 / 2027 " })

    expect(await can(SINCLASE, P_PROPIO)).toBe(true)
  })

  it("un proceso sin curso escolar no se abre por docencia", async () => {
    db.rows("processes").push({ id: "p-sin-curso", center_id: C1, school_year: null, status: "borrador", source_groups: ["6PA"] })

    expect(await can(NOEMI, "p-sin-curso")).toBe(false)
  })

  it("una docencia sin curso escolar tampoco abre un proceso sin curso escolar (vacío no es 'el mismo curso')", async () => {
    db.rows("teacher_group_access").push({ center_id: C1, user_id: SINCLASE.id, group_name: "6PA", school_year: "" })
    db.rows("processes").push({ id: "p-sin-curso", center_id: C1, school_year: null, status: "borrador", source_groups: ["6PA"] })

    expect(await can(SINCLASE, "p-sin-curso")).toBe(false)
    expect([...(await getAccessibleProcessIds(SINCLASE as never))]).toEqual([])
  })

  it("la comprobación de centro va primero: una asignación incoherente a otro centro no abre nada", async () => {
    expect(await can(ROSA, P_OTRO_CENTRO)).toBe(false)
  })

  it("solo el rol de profesorado usa tutorías, asignaciones y docencia: otro rol con esas filas no entra", async () => {
    expect(await can(EXTUTOR, P_PROPIO)).toBe(false) // su grupo 4PA es de origen de este proceso
    expect(await can(EXTUTOR, P_ASIGNADO)).toBe(false) // está asignado a este
    expect(await can(EXTUTOR, P_AJENO)).toBe(false) // y da clase en 6PA
  })

  it("otros roles y perfiles sin centro no entran", async () => {
    expect(await can(ALUMNO, P_PROPIO)).toBe(false)
    expect(await can({ ...ADMIN, center_id: null as unknown as string }, P_PROPIO)).toBe(false)
  })
})

describe("getAccessibleProcessIds", () => {
  const accessible = async (who: Profile) => [...(await getAccessibleProcessIds(who as never))].sort()

  it("administración y orientación reciben todos los procesos de su centro y ninguno de otro", async () => {
    expect(await accessible(ADMIN)).toEqual([P_ANTIGUO, P_AJENO, P_ASIGNADO, P_PROPIO].sort())
    expect(await accessible(ORIENTADOR)).toEqual([P_ANTIGUO, P_AJENO, P_ASIGNADO, P_PROPIO].sort())
    expect(await accessible(ADMIN_C2)).toEqual([P_OTRO_CENTRO])
  })

  it("un profesor recibe los de sus tutorías o asignaciones", async () => {
    expect(await accessible(ROSA)).toEqual([P_ANTIGUO, P_PROPIO].sort())
    expect(await accessible(LUIS)).toEqual([P_ASIGNADO])
  })

  it("y los de los grupos en los que da clase, solo del mismo curso escolar", async () => {
    expect(await accessible(NOEMI)).toEqual([P_AJENO])
    expect(await accessible(TEO)).toEqual([P_PROPIO]) // no p-antiguo: 4PA de otra cohorte
  })

  it("quien no tutoriza, ni da clase, ni está asignado, o cualquier otro rol, no recibe ninguno", async () => {
    expect(await accessible(SINCLASE)).toEqual([])
    expect(await accessible(ALUMNO)).toEqual([])
  })

  it("otro rol no recibe procesos aunque conserve filas de tutoría, asignación o docencia", async () => {
    expect(await accessible(EXTUTOR)).toEqual([])
  })

  it("coincide con canAccessProcess para cada persona y proceso", async () => {
    for (const who of [ADMIN, ORIENTADOR, ROSA, LUIS, NOEMI, TEO, SINCLASE, ALUMNO, EXTUTOR, ADMIN_C2]) {
      const set = await getAccessibleProcessIds(who as never)
      for (const processId of Object.keys(CENTER_OF)) {
        expect(set.has(processId), `${who.id} → ${processId}`).toBe(await canAccessProcess(who as never, processId))
      }
    }
  })
})

// Las rutas anteriores (procesos/[id]/…, sociograma, respuestas, cooperativo…) llaman a esta función
// directamente, sin el perfil: el rol lo lee ella para que la docencia solo abra procesos al profesorado.
describe("tutorCanAccessProcess", () => {
  const can = (who: Profile, processId: string) => tutorCanAccessProcess(who.center_id, who.id, processId)

  it("un profesor que da clase en un grupo de origen entra, y en otros no", async () => {
    expect(await can(NOEMI, P_AJENO)).toBe(true)
    expect(await can(NOEMI, P_PROPIO)).toBe(false)
  })

  it("la docencia de otro curso escolar no abre el proceso", async () => {
    expect(await can(TEO, P_ANTIGUO)).toBe(false)
  })

  it("con otro rol no entra por docencia aunque conserve sus filas", async () => {
    expect(await can(EXTUTOR, P_AJENO)).toBe(false) // da clase en 6PA, pero su cuenta es de alumnado
  })

  it("sin cuenta en este centro no entra por docencia", async () => {
    db.seed("users", [])
    expect(await can(NOEMI, P_AJENO)).toBe(false)

    db.seed("users", [{ id: NOEMI.id, center_id: C2, role: "tutor" }]) // cuenta de otro centro
    expect(await can(NOEMI, P_AJENO)).toBe(false)
  })

  it("un proceso de otro centro no se abre por docencia", async () => {
    db.rows("teacher_group_access").push({ center_id: C1, user_id: NOEMI.id, group_name: "4PA", school_year: "2026/2027" })

    expect(await can(NOEMI, P_OTRO_CENTRO)).toBe(false) // 4PA es de origen, pero el proceso es de c2
  })
})

describe("canAccessGroupSession", () => {
  const can = (who: Profile, processId: string, className: string | null) =>
    canAccessGroupSession(who as never, { process_id: processId, class_name: className })

  it("administración y orientación acceden a cualquier sesión", async () => {
    expect(await can(ADMIN, P_AJENO, "6PA")).toBe(true)
    expect(await can(ORIENTADOR, P_AJENO, null)).toBe(true)
  })

  it("un profesor solo accede a sesiones de las clases que tutoriza", async () => {
    expect(await can(ROSA, P_PROPIO, "4PA")).toBe(true)
    expect(await can(ROSA, P_PROPIO, "4PB")).toBe(false) // tiene el proceso, pero no esa clase
    expect(await can(ROSA, P_AJENO, "6PA")).toBe(false)
  })

  it("y a las de las clases en las que da clase, en procesos de ese mismo curso escolar", async () => {
    expect(await can(TEO, P_PROPIO, "4PA")).toBe(true)
    expect(await can(TEO, P_PROPIO, "4PB")).toBe(false) // no da clase en 4PB
    expect(await can(TEO, P_ANTIGUO, "4PA")).toBe(false) // 4PA del curso anterior: otra cohorte
    expect(await can(NOEMI, P_AJENO, "6PA")).toBe(true)
    expect(await can(NOEMI, P_AJENO, "6PB")).toBe(false)
  })

  it("una clase impartida solo en otro curso escolar no abre las sesiones de este", async () => {
    db.rows("teacher_group_access").push({ center_id: C1, user_id: SINCLASE.id, group_name: "4PA", school_year: "2025/2026" })

    expect(await can(SINCLASE, P_ANTIGUO, "4PA")).toBe(true)
    expect(await can(SINCLASE, P_PROPIO, "4PA")).toBe(false)
  })

  it("con otro rol no entra por docencia ni por una asignación antigua, y en un proceso de otro centro tampoco", async () => {
    expect(await can(EXTUTOR, P_AJENO, "6PA")).toBe(false)
    expect(await can(EXTUTOR, P_ASIGNADO, "5PA")).toBe(false) // sigue en process_tutors de p-asignado
    expect(await can(EXTUTOR, P_PROPIO, "4PA")).toBe(false) // y tutoriza 4PA en group_tutors
    db.rows("teacher_group_access").push({ center_id: C1, user_id: NOEMI.id, group_name: "4PA", school_year: "2026/2027" })
    expect(await can(NOEMI, P_OTRO_CENTRO, "4PA")).toBe(false)
  })

  it("una sesión sin clase no es accesible para un profesor", async () => {
    expect(await can(ROSA, P_PROPIO, null)).toBe(false)
  })

  it("otros roles sin acceso al proceso no entran", async () => {
    expect(await can(ALUMNO, P_PROPIO, "4PA")).toBe(false)
  })
})

// ── Historial ────────────────────────────────────────────────────────────────

describe("GET /api/history", () => {
  const history = async () => {
    const res = await historyGET()
    return { status: res.status, body: (await res.json()) as { id: string; total_students: number }[] }
  }

  beforeEach(() => {
    db.seed("students", [
      { id: "st1", process_id: P_PROPIO, active: true },
      { id: "st2", process_id: P_PROPIO, active: true },
      { id: "st3", process_id: P_AJENO, active: true },
    ])
    db.seed("sociogram_metrics", [
      { process_id: P_PROPIO, received_count: 0, reciprocal_count: 0, isolation_score: 1 },
      { process_id: P_AJENO, received_count: 0, reciprocal_count: 0, isolation_score: 1 },
    ])
  })

  it("un profesor solo recibe los procesos a los que tiene acceso, con sus cifras", async () => {
    const { status, body } = await history()

    expect(status).toBe(200)
    expect(body.map((p) => p.id).sort()).toEqual([P_ANTIGUO, P_PROPIO].sort())
    expect(body.find((p) => p.id === P_PROPIO)?.total_students).toBe(2)
  })

  it("un profesor sin procesos recibe una lista vacía sin consultar alumnado", async () => {
    as(SINCLASE)

    const { body } = await history()

    expect(body).toEqual([])
    expect(db.ops("students", "select")).toHaveLength(0)
    expect(db.ops("responses", "select")).toHaveLength(0)
  })

  it("administración recibe los procesos de todo su centro y ninguno de otro", async () => {
    as(ADMIN)

    const { body } = await history()

    expect(body.map((p) => p.id).sort()).toEqual([P_ANTIGUO, P_AJENO, P_ASIGNADO, P_PROPIO].sort())
  })
})

// ── Sociograma ───────────────────────────────────────────────────────────────

describe("GET /api/processes/[id]/sociogram/metrics", () => {
  const metrics = (id: string) => metricsGET(req(`/api/processes/${id}/sociogram/metrics`), params({ id }))

  beforeEach(() => {
    db.seed("sociogram_metrics", [
      { process_id: P_PROPIO, student_id: "st1", received_count: 3 },
      { process_id: P_AJENO, student_id: "st3", received_count: 0 },
    ])
  })

  it("un profesor lee las métricas de un proceso suyo", async () => {
    const res = await metrics(P_PROPIO)

    expect(res.status).toBe(200)
    expect(((await res.json()) as Row[]).map((m) => m.student_id)).toEqual(["st1"])
  })

  it("las de un proceso ajeno responden 404 y no se consultan", async () => {
    const res = await metrics(P_AJENO)

    expect(res.status).toBe(404)
    expect(db.ops("sociogram_metrics", "select")).toHaveLength(0)
  })

  it("administración lee las de cualquier proceso de su centro, no las de otro", async () => {
    as(ADMIN)

    expect((await metrics(P_AJENO)).status).toBe(200)
    expect((await metrics(P_OTRO_CENTRO)).status).toBe(404)
  })
})

// ── Propuestas ───────────────────────────────────────────────────────────────

describe("propuestas de un proceso ajeno", () => {
  const PR_PROPIA = "pr-propia"
  const PR_AJENA = "pr-ajena"
  const PR_OTRO_CENTRO = "pr-otro-centro"

  beforeEach(() => {
    db.seed("proposals", [
      proposalRow(PR_PROPIA, P_PROPIO),
      proposalRow(PR_AJENA, P_AJENO),
      proposalRow(PR_OTRO_CENTRO, P_OTRO_CENTRO),
    ])
    db.seed("proposal_assignments", [
      { id: "a1", proposal_id: PR_PROPIA, student_id: "st1", target_class: "1A" },
      { id: "a2", proposal_id: PR_AJENA, student_id: "st3", target_class: "1A" },
    ])
    db.seed("proposal_class_tutors", [{ id: "t1", proposal_id: PR_AJENA, target_class: "1A", user_id: ADMIN.id }])
  })

  describe("GET/PATCH/DELETE /api/proposals/[id]", () => {
    const get = (id: string) => proposalGET(req(`/api/proposals/${id}`), params({ id }))
    const patch = (id: string, body: object) => proposalPATCH(req(`/api/proposals/${id}`, jsonInit("PATCH", body)), params({ id }))
    const del = (id: string) => proposalDELETE(req(`/api/proposals/${id}`, { method: "DELETE" }), params({ id }))

    it("un profesor abre una propuesta de un proceso suyo", async () => {
      const res = await get(PR_PROPIA)

      expect(res.status).toBe(200)
      expect(((await res.json()) as Row).id).toBe(PR_PROPIA)
    })

    it("la de un proceso ajeno responde 404 sin devolver datos", async () => {
      const res = await get(PR_AJENA)

      expect(res.status).toBe(404)
      expect(JSON.stringify(await res.json())).not.toContain("st3")
    })

    it("administración abre las del centro y no las de otro", async () => {
      as(ADMIN)

      expect((await get(PR_AJENA)).status).toBe(200)
      expect((await get(PR_OTRO_CENTRO)).status).toBe(404)
    })

    it("un profesor no modifica una propuesta de un proceso ajeno", async () => {
      const res = await patch(PR_AJENA, { name: "Cambiada" })

      expect(res.status).toBe(404)
      expect(stored("proposals", PR_AJENA)?.name).toBe(`Propuesta ${PR_AJENA}`)
      expect(db.ops("proposals", "update")).toHaveLength(0)
    })

    it("sí puede renombrar una propuesta de un proceso suyo, pero no aprobarla", async () => {
      expect((await patch(PR_PROPIA, { name: "Mi propuesta" })).status).toBe(200)
      expect(stored("proposals", PR_PROPIA)?.name).toBe("Mi propuesta")

      expect((await patch(PR_PROPIA, { status: "aprobada" })).status).toBe(403)
      expect(stored("proposals", PR_PROPIA)?.status).toBe("borrador")
    })

    it("solo administración elimina; y nunca una de otro centro", async () => {
      expect((await del(PR_PROPIA)).status).toBe(403)

      as(ADMIN)
      expect((await del(PR_OTRO_CENTRO)).status).toBe(404)
      expect(stored("proposals", PR_OTRO_CENTRO)).toBeDefined()
      expect((await del(PR_AJENA)).status).toBe(200)
      expect(stored("proposals", PR_AJENA)).toBeUndefined()
    })
  })

  describe("GET/PUT /api/proposals/[id]/tutors", () => {
    const list = (id: string) => tutorsGET(req(`/api/proposals/${id}/tutors`), params({ id }))
    const put = (id: string, body: object) => tutorsPUT(req(`/api/proposals/${id}/tutors`, jsonInit("PUT", body)), params({ id }))

    it("un profesor lee las tutorías de una propuesta suya", async () => {
      expect((await list(PR_PROPIA)).status).toBe(200)
    })

    it("las de una propuesta ajena responden 404", async () => {
      const res = await list(PR_AJENA)

      expect(res.status).toBe(404)
      expect(db.ops("proposal_class_tutors", "select")).toHaveLength(0)
    })

    it("no puede asignar ni quitar tutores en una propuesta ajena", async () => {
      expect((await put(PR_AJENA, { target_class: "1A", user_id: null })).status).toBe(404)
      expect((await put(PR_AJENA, { target_class: "1A", user_id: ROSA.id })).status).toBe(404)

      expect(db.ops("proposal_class_tutors", "delete")).toHaveLength(0)
      expect(db.ops("proposal_class_tutors", "upsert")).toHaveLength(0)
      expect(stored("proposal_class_tutors", "t1")).toBeDefined()
    })
  })

  describe("descargas y recálculo", () => {
    const exportXlsx = (id: string) => exportGET(req(`/api/proposals/${id}/export`), params({ id }))
    const exportPdf = (id: string) => exportPdfGET(req(`/api/proposals/${id}/export/pdf`), params({ id }))
    const recalculate = (id: string) => recalculatePOST(req(`/api/proposals/${id}/recalculate`, { method: "POST" }), params({ id }))

    it("el Excel de una propuesta ajena responde 403 sin leer respuestas ni alumnado", async () => {
      const res = await exportXlsx(PR_AJENA)

      expect(res.status).toBe(403)
      expect(db.ops("responses", "select")).toHaveLength(0)
      expect(db.ops("rules", "select")).toHaveLength(0)
    })

    it("el PDF de una propuesta ajena responde 403", async () => {
      expect((await exportPdf(PR_AJENA)).status).toBe(403)
    })

    it("recalcular una propuesta ajena responde 403 y no toca asignaciones", async () => {
      const res = await recalculate(PR_AJENA)

      expect(res.status).toBe(403)
      expect(db.ops("proposal_assignments", "delete")).toHaveLength(0)
      expect(db.ops("proposal_assignments", "insert")).toHaveLength(0)
      expect(db.ops("students", "select")).toHaveLength(0)
    })

    it("con acceso al proceso, el Excel se genera", async () => {
      const res = await exportXlsx(PR_PROPIA)

      expect(res.status).toBe(200)
    })

    it("administración descarga las del centro, no las de otro", async () => {
      as(ADMIN)

      expect((await exportXlsx(PR_AJENA)).status).toBe(200)
      expect((await exportXlsx(PR_OTRO_CENTRO)).status).toBe(403)
    })
  })
})

// ── Reglas ───────────────────────────────────────────────────────────────────

describe("reglas de un proceso ajeno", () => {
  const create = (body: object) => rulesPOST(req("/api/rules", jsonInit("POST", body)))
  const valid = (processId: string) => ({ process_id: processId, rule_type: "must_separate", priority: "alta", student_ids: ["st1", "st2"] })
  const patch = (id: string, body: object) => rulePATCH(req(`/api/rules/${id}`, jsonInit("PATCH", body)), params({ id }))
  const del = (id: string) => ruleDELETE(req(`/api/rules/${id}`, { method: "DELETE" }), params({ id }))

  beforeEach(() => {
    db.seed("rules", [ruleRow("r-propia", P_PROPIO), ruleRow("r-ajena", P_AJENO), ruleRow("r-otro-centro", P_OTRO_CENTRO)])
  })

  it("un profesor crea una regla en un proceso suyo", async () => {
    const res = await create(valid(P_PROPIO))

    expect(res.status).toBe(201)
    expect(db.ops("rules", "insert")).toHaveLength(1)
  })

  it("no puede crearla en un proceso ajeno ni de otro centro", async () => {
    expect((await create(valid(P_AJENO))).status).toBe(403)
    expect((await create(valid(P_OTRO_CENTRO))).status).toBe(403)

    expect(db.ops("rules", "insert")).toHaveLength(0)
    expect(db.ops("rule_students", "insert")).toHaveLength(0)
  })

  it("un profesor borra una regla de un proceso suyo, no de uno ajeno", async () => {
    expect((await del("r-ajena")).status).toBe(403)
    expect(stored("rules", "r-ajena")).toBeDefined()

    expect((await del("r-propia")).status).toBe(200)
    expect(stored("rules", "r-propia")).toBeUndefined()
  })

  it("modificar reglas sigue siendo cosa de administración y orientación", async () => {
    expect((await patch("r-propia", { priority: "baja" })).status).toBe(403)

    as(ORIENTADOR)
    expect((await patch("r-ajena", { priority: "baja" })).status).toBe(200)
    expect((await patch("r-otro-centro", { priority: "baja" })).status).toBe(403)
  })
})

// ── Documentos ───────────────────────────────────────────────────────────────

describe("GET /api/processes/[id]/documents", () => {
  const list = (id: string) => documentsGET(req(`/api/processes/${id}/documents`), params({ id }))

  beforeEach(() => {
    db.seed("process_documents", [
      { id: "d1", process_id: P_PROPIO, center_id: C1, name: "Informe 4º", original_filename: "a.pdf", created_at: "2026-09-10" },
      { id: "d2", process_id: P_AJENO, center_id: C1, name: "Informe 6º", original_filename: "b.pdf", created_at: "2026-09-11" },
    ])
  })

  it("un profesor lista los documentos de un proceso suyo", async () => {
    const res = await list(P_PROPIO)

    expect(res.status).toBe(200)
    expect(ids(((await res.json()) as { documents: Row[] }).documents)).toEqual(["d1"])
  })

  it("los de un proceso ajeno responden 404 sin consultarse", async () => {
    const res = await list(P_AJENO)

    expect(res.status).toBe(404)
    expect(db.ops("process_documents", "select")).toHaveLength(0)
  })
})

// ── Grupos cooperativos (conjuntos) ──────────────────────────────────────────

describe("conjuntos de grupos", () => {
  const GS_PROPIO = "gs-propio" // clase 4PA, proceso suyo
  const GS_OTRA_CLASE = "gs-otra-clase" // clase 4PB: tiene el proceso, no la clase
  const GS_AJENO = "gs-ajeno" // clase 6PA, proceso ajeno
  const GS_OTRO_CENTRO = "gs-otro-centro"

  const get = (id: string) => setGET(req(`/api/group-sets/${id}`), params({ id }))
  const patch = (id: string) => setPATCH(req(`/api/group-sets/${id}`, jsonInit("PATCH", { assignments: [] })), params({ id }))
  const del = (id: string) => setDELETE(req(`/api/group-sets/${id}`, { method: "DELETE" }), params({ id }))
  const approve = (id: string) => approvePOST(req(`/api/group-sets/${id}/approve`, { method: "POST" }), params({ id }))
  const unapprove = (id: string) => unapproveDELETE(req(`/api/group-sets/${id}/approve`, { method: "DELETE" }), params({ id }))

  beforeEach(() => {
    db.seed("group_sets", [
      setRow(GS_PROPIO, P_PROPIO, "4PA"),
      setRow(GS_OTRA_CLASE, P_PROPIO, "4PB"),
      setRow(GS_AJENO, P_AJENO, "6PA"),
      setRow(GS_OTRO_CENTRO, P_OTRO_CENTRO, "4PA"),
    ])
    db.seed("group_assignments", [{ id: "ga1", group_set_id: GS_AJENO, student_id: "st3", group_number: 1 }])
  })

  it("un profesor abre el conjunto de una clase que tutoriza", async () => {
    expect((await get(GS_PROPIO)).status).toBe(200)
  })

  it("quien da clase en 4PA abre el conjunto de 4PA, no el de 4PB ni lo modifica", async () => {
    as(TEO)

    expect((await get(GS_PROPIO)).status).toBe(200)
    expect((await get(GS_OTRA_CLASE)).status).toBe(403)
    expect((await patch(GS_OTRA_CLASE)).status).toBe(403)
    expect((await approve(GS_OTRA_CLASE)).status).toBe(404)
  })

  it("no abre el de otra clase, aunque tenga el proceso, ni el de un proceso ajeno", async () => {
    expect((await get(GS_OTRA_CLASE)).status).toBe(403)
    expect((await get(GS_AJENO)).status).toBe(403)
  })

  it("no lo modifica, borra ni aprueba en clases ajenas", async () => {
    for (const id of [GS_OTRA_CLASE, GS_AJENO, GS_OTRO_CENTRO]) {
      expect((await patch(id)).status).toBe(403)
      expect((await del(id)).status).toBe(403)
      expect((await approve(id)).status).toBe(404)
      expect((await unapprove(id)).status).toBe(404)
      expect(stored("group_sets", id)).toBeDefined()
    }
    expect(db.ops("group_assignments", "delete")).toHaveLength(0)
    expect(db.ops("group_sets", "update")).toHaveLength(0)
  })

  it("sí puede aprobar y retirar la aprobación en una clase suya", async () => {
    expect((await approve(GS_PROPIO)).status).toBe(200)
    expect(stored("group_sets", GS_PROPIO)?.status).toBe("aprobado")

    expect((await unapprove(GS_PROPIO)).status).toBe(200)
    expect(stored("group_sets", GS_PROPIO)?.status).toBe("generado")
  })

  it("administración accede a los del centro, no a los de otro", async () => {
    as(ADMIN)

    expect((await get(GS_AJENO)).status).toBe(200)
    expect((await get(GS_OTRO_CENTRO)).status).toBe(403)
    expect((await approve(GS_OTRO_CENTRO)).status).toBe(404)
  })
})

// ── Avisos (campana) ─────────────────────────────────────────────────────────

describe("GET /api/notifications", () => {
  const notifications = async () =>
    (await (await notificationsGET()).json()) as {
      pending_tokens: number
      pending_proposals: number
      total: number
      process_ids_with_proposals?: string[]
    }

  beforeEach(() => {
    db.seed("processes", [
      { id: P_PROPIO, center_id: C1, school_year: "2026-2027", status: "cuestionario_abierto", source_groups: ["4PA", "4PB"] },
      { id: P_AJENO, center_id: C1, school_year: "2026-2027", status: "cuestionario_abierto", source_groups: ["6PA"] },
      { id: P_ANTIGUO, center_id: C1, school_year: "2025-2026", status: "propuestas_generadas", source_groups: ["4PA"] },
      { id: P_ASIGNADO, center_id: C1, school_year: "2026-2027", status: "propuestas_generadas", source_groups: ["5PA"] },
      { id: P_OTRO_CENTRO, center_id: C2, school_year: "2026-2027", status: "propuestas_generadas", source_groups: ["4PA"] },
    ])
    db.seed("questionnaire_tokens", [
      { id: "k1", process_id: P_PROPIO, completed_at: null },
      { id: "k2", process_id: P_PROPIO, completed_at: null },
      { id: "k3", process_id: P_PROPIO, completed_at: "2026-09-10" },
      { id: "k4", process_id: P_AJENO, completed_at: null },
    ])
  })

  it("un profesor solo recibe avisos de los procesos a los que tiene acceso", async () => {
    const body = await notifications()

    expect(body.pending_tokens).toBe(2) // los de p-propio; no el de p-ajeno
    expect(body.process_ids_with_proposals).toEqual([P_ANTIGUO]) // no p-asignado
    expect(body.pending_proposals).toBe(1)
  })

  it("otro profesor solo ve los suyos por asignación", async () => {
    as(LUIS)

    const body = await notifications()

    expect(body.pending_tokens).toBe(0)
    expect(body.process_ids_with_proposals).toEqual([P_ASIGNADO])
  })

  it("quien da clase en un grupo recibe los avisos del proceso de ese grupo", async () => {
    as(NOEMI)

    const body = await notifications()

    expect(body.pending_tokens).toBe(1) // el de p-ajeno (6PA)
    expect(body.process_ids_with_proposals).toEqual([])
  })

  it("un profesor sin procesos no recibe ningún aviso", async () => {
    as(SINCLASE)

    expect(await notifications()).toMatchObject({ pending_tokens: 0, pending_proposals: 0, total: 0 })
  })

  it("administración recibe los del centro entero y ninguno de otro", async () => {
    as(ADMIN)

    const body = await notifications()

    expect(body.pending_tokens).toBe(3)
    expect([...(body.process_ids_with_proposals ?? [])].sort()).toEqual([P_ANTIGUO, P_ASIGNADO].sort())
  })
})

// ── Importar respuestas de otro proceso ──────────────────────────────────────

describe("GET /api/processes/[id]/questionnaire/import-responses", () => {
  const sources = (id: string) => importSourcesGET(req(`/api/processes/${id}/questionnaire/import-responses`), params({ id }))

  beforeEach(() => {
    db.seed("responses", [
      { id: "resp1", process_id: P_ANTIGUO },
      { id: "resp2", process_id: P_AJENO },
      { id: "resp3", process_id: P_ASIGNADO },
      { id: "resp4", process_id: P_PROPIO },
    ])
  })

  it("un profesor solo puede elegir como origen procesos suyos", async () => {
    const res = await sources(P_PROPIO)

    expect(res.status).toBe(200)
    expect(ids((await res.json()) as Row[])).toEqual([P_ANTIGUO]) // no p-ajeno ni p-asignado
  })

  it("no lista nada para un proceso destino ajeno", async () => {
    const res = await sources(P_AJENO)

    expect(res.status).toBe(404)
    expect(db.ops("responses", "select")).toHaveLength(0)
  })

  it("administración ve como posibles orígenes todos los del centro con respuestas", async () => {
    as(ADMIN)

    const res = await sources(P_PROPIO)

    expect(ids((await res.json()) as Row[])).toEqual([P_ANTIGUO, P_AJENO, P_ASIGNADO].sort())
  })
})
