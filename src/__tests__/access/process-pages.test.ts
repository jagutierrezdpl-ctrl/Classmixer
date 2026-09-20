import { describe, it, expect, vi, beforeEach } from "vitest"
import { getUserProfile } from "@/lib/auth"
import { notFound } from "next/navigation"
import ProcessDetailPage from "@/app/(dashboard)/processes/[id]/page"
import ResponsesPage from "@/app/(dashboard)/processes/[id]/responses/page"
import StudentDetailPage from "@/app/(dashboard)/processes/[id]/students/[studentId]/page"
import StudentReportPage from "@/app/(dashboard)/processes/[id]/students/[studentId]/report/page"
import PrintPage from "@/app/(dashboard)/processes/[id]/proposals/[proposalId]/print/page"
import ReportPage from "@/app/(dashboard)/processes/[id]/proposals/[proposalId]/report/page"
import { FakeSupabase } from "../helpers/fake-supabase"

// Las páginas de un proceso son componentes de servidor que leen con el cliente de servicio (sin RLS):
// si no comprueban el acceso, cualquier profesor del centro abre por URL las respuestas, las métricas
// y los informes de los alumnos de otras clases. Aquí se llama a cada página como lo hace Next y se
// comprueba que quien no tiene acceso recibe un 404 ANTES de que la página lea datos.

let db: FakeSupabase

vi.mock("@/lib/supabase/server", () => ({ createServiceClient: () => db, createClient: vi.fn() }))
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND")
  }),
  redirect: vi.fn(),
}))
// La sesión se simula (getUserProfile); las reglas de acceso son las reales y leen del doble de Supabase.
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
const ROSA = profileOf("u-rosa", "tutor") // tutoriza 4PA
const LUIS = profileOf("u-luis", "tutor") // asignado a mano a p-asignado
const NOEMI = profileOf("u-noemi", "tutor") // solo da clase en 6PA (sin tutoría)
const ALUMNO = profileOf("u-alumno", "alumno") // conserva filas de docencia: el rol manda

const P_PROPIO = "p-propio" // grupos de origen 4PA, 4PB
const P_AJENO = "p-ajeno" // grupo de origen 6PA
const P_ANTIGUO = "p-antiguo" // curso anterior, grupo de origen 6PA
const P_ASIGNADO = "p-asignado" // grupo de origen 5PA, con LUIS en process_tutors
const P_OTRO_CENTRO = "p-otro-centro" // del centro c2

// Tablas que lee la propia comprobación de acceso; cualquier otra lectura es "datos".
const GATE_TABLES = ["processes", "process_tutors", "group_tutors", "teacher_group_access", "users"]

const as = (p: Profile | null) => vi.mocked(getUserProfile).mockResolvedValue(p as never)
const dataReads = () => db.log.filter((l) => !GATE_TABLES.includes(l.table)).map((l) => `${l.op} ${l.table}`)

type PageCase = { name: string; render: (processId: string) => Promise<unknown> }
const pages: PageCase[] = [
  { name: "detalle del proceso", render: (id) => ProcessDetailPage({ params: Promise.resolve({ id }) }) },
  { name: "respuestas", render: (id) => ResponsesPage({ params: Promise.resolve({ id }) }) },
  {
    name: "ficha del alumno en el proceso",
    render: (id) => StudentDetailPage({ params: Promise.resolve({ id, studentId: "e1" }) }),
  },
  {
    name: "informe del alumno",
    render: (id) => StudentReportPage({ params: Promise.resolve({ id, studentId: "e1" }) }),
  },
  { name: "propuesta (impresión)", render: (id) => PrintPage({ params: Promise.resolve({ id, proposalId: "pr1" }) }) },
  { name: "propuesta (informe)", render: (id) => ReportPage({ params: Promise.resolve({ id, proposalId: "pr1" }) }) },
]

beforeEach(() => {
  vi.clearAllMocks()
  db = new FakeSupabase()
  db.seed("processes", [
    { id: P_PROPIO, center_id: C1, name: "Mezcla 4º", school_year: "2026-2027", status: "en_analisis", source_groups: ["4PA", "4PB"] },
    { id: P_AJENO, center_id: C1, name: "Mezcla 6º", school_year: "2026-2027", status: "en_analisis", source_groups: ["6PA"] },
    { id: P_ANTIGUO, center_id: C1, name: "Mezcla 6º anterior", school_year: "2025-2026", status: "cerrado", source_groups: ["6PA"] },
    { id: P_ASIGNADO, center_id: C1, name: "Mezcla 5º", school_year: "2026-2027", status: "borrador", source_groups: ["5PA"] },
    { id: P_OTRO_CENTRO, center_id: C2, name: "Otro centro", school_year: "2026-2027", status: "en_analisis", source_groups: ["4PA"] },
  ])
  db.seed("group_tutors", [{ center_id: C1, user_id: ROSA.id, group_name: "4PA", school_year: "2026/2027" }])
  db.seed("teacher_group_access", [
    { center_id: C1, user_id: NOEMI.id, group_name: "6PA", school_year: "2026/2027" },
    { center_id: C1, user_id: ALUMNO.id, group_name: "6PA", school_year: "2026/2027" },
  ])
  db.seed("users", [
    ...[ROSA, LUIS, NOEMI].map((u) => ({ id: u.id, center_id: C1, role: "tutor" })),
    { id: ALUMNO.id, center_id: C1, role: "alumno" },
  ])
  db.seed("process_tutors", [{ id: "pt1", process_id: P_ASIGNADO, user_id: LUIS.id }])
  db.seed("students", [{ id: "e1", process_id: P_AJENO, name: "Alumno 1" }])
})

describe.each(pages)("página: $name", ({ render }) => {
  it("sin sesión responde 404 sin leer datos", async () => {
    as(null)

    await expect(render(P_PROPIO)).rejects.toThrow("NEXT_NOT_FOUND")
    expect(dataReads()).toEqual([])
  })

  it("un profesor no abre un proceso de grupos que no tutoriza", async () => {
    as(ROSA)

    await expect(render(P_AJENO)).rejects.toThrow("NEXT_NOT_FOUND")
    expect(notFound).toHaveBeenCalledTimes(1)
    expect(dataReads()).toEqual([])
  })

  it("dar clase en otro grupo tampoco abre el proceso", async () => {
    as(NOEMI)

    await expect(render(P_PROPIO)).rejects.toThrow("NEXT_NOT_FOUND")
    expect(dataReads()).toEqual([])
  })

  it("un grupo que se llama igual en otro curso escolar es otra cohorte: no abre el proceso anterior", async () => {
    as(NOEMI)

    await expect(render(P_ANTIGUO)).rejects.toThrow("NEXT_NOT_FOUND")
    expect(dataReads()).toEqual([])
  })

  it("un profesor tampoco entra en procesos de otras tutorías aunque sean del centro", async () => {
    as(LUIS)

    await expect(render(P_PROPIO)).rejects.toThrow("NEXT_NOT_FOUND")
    expect(dataReads()).toEqual([])
  })

  it("nadie abre un proceso de otro centro, ni administración", async () => {
    as(ADMIN)

    await expect(render(P_OTRO_CENTRO)).rejects.toThrow("NEXT_NOT_FOUND")
    expect(dataReads()).toEqual([])
  })

  it("un proceso que no existe responde 404", async () => {
    as(ADMIN)

    await expect(render("no-existe")).rejects.toThrow("NEXT_NOT_FOUND")
    expect(dataReads()).toEqual([])
  })

  it("el alumnado no abre páginas de gestión, ni con filas de docencia de un cambio de rol", async () => {
    as(ALUMNO)

    await expect(render(P_AJENO)).rejects.toThrow("NEXT_NOT_FOUND")
    expect(dataReads()).toEqual([])
  })

  // Quien sí tiene acceso pasa la comprobación y la página empieza a leer sus datos (lo que ocurra
  // después depende del contenido de cada página y no es lo que se prueba aquí).
  it.each([
    ["administración, cualquier proceso del centro", ADMIN, P_AJENO],
    ["un profesor, proceso de un grupo que tutoriza", ROSA, P_PROPIO],
    ["un profesor, proceso de un grupo en el que da clase", NOEMI, P_AJENO],
    ["un profesor, proceso al que está asignado", LUIS, P_ASIGNADO],
  ])("%s: pasa la comprobación y lee datos", async (_label, who, processId) => {
    as(who)

    await render(processId).catch(() => undefined)

    expect(dataReads().length).toBeGreaterThan(0)
  })
})
