import { describe, it, expect, vi, beforeEach } from "vitest"
import { getUserProfile } from "@/lib/auth"
import { GET as processesGET, POST as processesPOST } from "@/app/api/processes/route"
import ProcessesPage from "@/app/(dashboard)/processes/page"
import { GET as sessionsGET, POST as sessionsPOST } from "@/app/api/cooperative/route"
import { GET as classesGET } from "@/app/api/cooperative/classes/route"
import { GET as rulesGET, POST as rulesPOST } from "@/app/api/cooperative/[sessionId]/rules/route"
import { DELETE as ruleDELETE } from "@/app/api/cooperative/[sessionId]/rules/[ruleId]/route"
import { FakeSupabase, type Row } from "../helpers/fake-supabase"

// Quién ve y toca los procesos y las sesiones de grupos cooperativos. Regla común: un profesor (rol
// "tutor") llega a lo que tutoriza, a lo que se le asignó a mano y a las clases en las que da clase,
// estas últimas solo en procesos del mismo curso escolar; administración y orientación, a todo el centro.

let db: FakeSupabase

vi.mock("@/lib/supabase/server", () => ({ createServiceClient: () => db, createClient: vi.fn() }))
vi.mock("next/navigation", () => ({ redirect: vi.fn() }))
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
const ROSA = profileOf("u-rosa", "tutor") // tutoriza 4PA; da clase en 1º ESO A
const LUIS = profileOf("u-luis", "tutor") // sin clases; asignado a mano a p-asignado
const NOEMI = profileOf("u-noemi", "tutor") // solo da clase en 6PA
const TEO = profileOf("u-teo", "tutor") // solo da clase en 4PA
const SINCLASE = profileOf("u-sinclase", "tutor")
const ALUMNO = profileOf("u-alumno", "alumno")
// Fue profesor y ahora es alumnado, pero conserva tutoría, asignación y docencia: el rol manda.
const EXTUTOR = profileOf("u-extutor", "alumno")
const ADMIN_C2 = profileOf("u-admin2", "admin", C2)

const P_PROPIO = "p-propio" // 4PA, 4PB — curso actual
const P_ANTIGUO = "p-antiguo" // 4PA — curso anterior
const P_AJENO = "p-ajeno" // 6PA — curso actual
const P_ASIGNADO = "p-asignado" // 5PA — curso actual, con LUIS y EXTUTOR en process_tutors
const P_OTRO_CENTRO = "p-otro-centro" // del centro c2

const as = (p: Profile | null) => vi.mocked(getUserProfile).mockResolvedValue(p as never)
const params = <T extends object>(p: T) => ({ params: Promise.resolve(p) })
const jsonReq = (method: string, body: unknown) =>
  new Request("http://localhost/api", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
const ids = (rows: Row[]) => rows.map((r) => r.id).sort()

const session = (id: string, processId: string, className: string, center = C1): Row => ({
  id,
  process_id: processId,
  class_name: className,
  name: id,
  created_at: "2026-09-10",
  processes: { center_id: center },
})
const S_4PA_PROPIO = "ses-4pa-propio"
const S_4PB_PROPIO = "ses-4pb-propio"
const S_4PA_ANTIGUO = "ses-4pa-antiguo"
const S_6PA_AJENO = "ses-6pa-ajeno"
const S_5PA_ASIGNADO = "ses-5pa-asignado"
const S_OTRO_CENTRO = "ses-otro-centro"

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
    { center_id: C1, user_id: EXTUTOR.id, group_name: "4PA", school_year: "2026/2027" },
  ])
  db.seed("process_tutors", [
    { id: "pt1", process_id: P_ASIGNADO, user_id: LUIS.id },
    { id: "pt2", process_id: P_ASIGNADO, user_id: EXTUTOR.id },
  ])
  db.seed("teacher_group_access", [
    { center_id: C1, user_id: ROSA.id, group_name: "1º ESO A", school_year: "2026/2027" },
    { center_id: C1, user_id: NOEMI.id, group_name: "6PA", school_year: "2026/2027" },
    { center_id: C1, user_id: TEO.id, group_name: "4PA", school_year: "2026/2027" },
    { center_id: C1, user_id: EXTUTOR.id, group_name: "6PA", school_year: "2026/2027" },
  ])
  db.seed("users", [
    ...[ROSA, LUIS, NOEMI, TEO, SINCLASE].map((u) => ({ id: u.id, center_id: C1, role: "tutor" })),
    ...[ALUMNO, EXTUTOR].map((u) => ({ id: u.id, center_id: C1, role: "alumno" })),
  ])
  db.seed("group_sessions", [
    session(S_4PA_PROPIO, P_PROPIO, "4PA"),
    session(S_4PB_PROPIO, P_PROPIO, "4PB"),
    session(S_4PA_ANTIGUO, P_ANTIGUO, "4PA"),
    session(S_6PA_AJENO, P_AJENO, "6PA"),
    session(S_5PA_ASIGNADO, P_ASIGNADO, "5PA"),
    session(S_OTRO_CENTRO, P_OTRO_CENTRO, "4PA", C2),
  ])
  as(ADMIN)
})

// ── Lista de procesos ────────────────────────────────────────────────────────

describe("GET /api/processes", () => {
  const list = async () => {
    const res = await processesGET(new Request("http://localhost/api/processes"))
    return { status: res.status, body: (await res.json()) as Row[] }
  }

  it("administración recibe todos los procesos de su centro y no los de otro", async () => {
    const { body } = await list()

    expect(ids(body)).toEqual([P_ANTIGUO, P_AJENO, P_ASIGNADO, P_PROPIO].sort())
  })

  it("un profesor recibe los de sus tutorías, con el histórico de sus grupos", async () => {
    as(ROSA)

    expect(ids((await list()).body)).toEqual([P_ANTIGUO, P_PROPIO].sort())
  })

  it("y los asignados a mano", async () => {
    as(LUIS)

    expect(ids((await list()).body)).toEqual([P_ASIGNADO])
  })

  it("y los de los grupos en los que da clase, solo del mismo curso escolar", async () => {
    as(NOEMI)
    expect(ids((await list()).body)).toEqual([P_AJENO])

    as(TEO)
    expect(ids((await list()).body)).toEqual([P_PROPIO]) // no p-antiguo: 4PA de otra cohorte
  })

  it("quien no tutoriza, ni da clase, ni está asignado no recibe ninguno", async () => {
    as(SINCLASE)

    expect((await list()).body).toEqual([])
  })

  it("con otro rol no recibe nada aunque conserve filas de tutoría, asignación o docencia", async () => {
    as(EXTUTOR)
    expect((await list()).body).toEqual([])

    as(ALUMNO)
    expect((await list()).body).toEqual([])
  })

  it("sin sesión responde 401", async () => {
    as(null)

    expect((await list()).status).toBe(401)
  })
})

describe("POST /api/processes", () => {
  const create = (who: Profile, groups: string) => {
    as(who)
    return processesPOST(
      jsonReq("POST", {
        name: "Proceso nuevo",
        school_year: "2026-2027",
        process_type: "mezcla",
        source_level: "6º",
        source_groups: groups,
      })
    )
  }

  it("un profesor solo crea procesos sobre grupos que tutoriza, no sobre los que solo imparte", async () => {
    const res = await create(NOEMI, "6PA") // da clase en 6PA, no lo tutoriza

    expect(res.status).toBe(403)
    expect(db.ops("processes", "insert")).toEqual([])
  })

  it("tampoco sobre grupos de otro profesor", async () => {
    const res = await create(ROSA, "4PA,6PA")

    expect(res.status).toBe(403)
    expect(db.ops("processes", "insert")).toEqual([])
  })
})

// La página de lista es un componente de servidor: se llama como lo hace Next y se mira para qué procesos
// pide las cifras (alumnado, cuestionarios, propuestas), que son los que muestra.
describe("página /processes", () => {
  const shown = async (who: Profile) => {
    as(who)
    db.log.length = 0
    await ProcessesPage()
    const queried = db.ops("students", "select").flatMap((op) => (op.inValues?.process_id ?? []) as string[])
    return [...new Set(queried)].sort()
  }

  it("administración lista todos los procesos de su centro", async () => {
    expect(await shown(ADMIN)).toEqual([P_ANTIGUO, P_AJENO, P_ASIGNADO, P_PROPIO].sort())
  })

  it("un profesor lista los de sus tutorías, sus asignaciones y sus clases del mismo curso escolar", async () => {
    expect(await shown(ROSA)).toEqual([P_ANTIGUO, P_PROPIO].sort())
    expect(await shown(LUIS)).toEqual([P_ASIGNADO])
    expect(await shown(NOEMI)).toEqual([P_AJENO])
    expect(await shown(TEO)).toEqual([P_PROPIO]) // no p-antiguo: 4PA de otra cohorte
  })

  it("quien no tiene nada, o tiene otro rol con filas antiguas, no lista ninguno", async () => {
    for (const who of [SINCLASE, ALUMNO, EXTUTOR]) expect(await shown(who), who.id).toEqual([])
  })
})

// ── Sesiones de grupos cooperativos ──────────────────────────────────────────

describe("GET /api/cooperative", () => {
  const list = async () => {
    const res = await sessionsGET(new Request("http://localhost/api/cooperative"))
    return { status: res.status, body: (await res.json()) as Row[] }
  }

  it("administración recibe las sesiones de todo su centro, con el nombre del proceso", async () => {
    const { body } = await list()

    expect(ids(body)).toEqual([S_4PA_ANTIGUO, S_4PA_PROPIO, S_4PB_PROPIO, S_5PA_ASIGNADO, S_6PA_AJENO].sort())
    expect(body.find((s) => s.id === S_6PA_AJENO)?.process_name).toBe("Mezcla 6º")
  })

  it("un profesor recibe solo las sesiones de las clases que tutoriza, en los procesos a los que tiene acceso", async () => {
    as(ROSA)

    expect(ids((await list()).body)).toEqual([S_4PA_ANTIGUO, S_4PA_PROPIO].sort()) // no la de 4PB
  })

  it("y las de las clases en las que da clase", async () => {
    as(NOEMI)
    expect(ids((await list()).body)).toEqual([S_6PA_AJENO])

    as(TEO)
    expect(ids((await list()).body)).toEqual([S_4PA_PROPIO]) // no la de 4PB, no la del curso anterior
  })

  it("una asignación a un proceso anterior no abre las sesiones de una clase que solo imparte este curso", async () => {
    db.rows("process_tutors").push({ id: "pt3", process_id: P_ANTIGUO, user_id: TEO.id })
    as(TEO)

    // Tiene el proceso anterior (asignado) y da clase en 4PA, pero ese 4PA es del curso pasado.
    expect(ids((await list()).body)).toEqual([S_4PA_PROPIO])
  })

  it("una clase impartida solo el curso anterior no abre sus sesiones aunque el proceso sea accesible por otra clase", async () => {
    // Da clase en 4PA este curso (le abre p-propio) y dio 4PB el curso pasado: la sesión de 4PB de este curso no es suya.
    db.rows("teacher_group_access").push({ center_id: C1, user_id: TEO.id, group_name: "4PB", school_year: "2025/2026" })
    as(TEO)

    expect(ids((await list()).body)).toEqual([S_4PA_PROPIO])
  })

  it("la clase que tutoriza no abre las sesiones de un proceso al que no tiene acceso", async () => {
    db.rows("group_sessions").push(session("ses-4pa-en-ajeno", P_AJENO, "4PA")) // 4PA la tutoriza Rosa; p-ajeno no es suyo
    as(ROSA)

    expect(ids((await list()).body)).toEqual([S_4PA_ANTIGUO, S_4PA_PROPIO].sort())
  })

  it("quien tiene un proceso pero ninguna clase no recibe sesiones", async () => {
    as(LUIS)

    expect((await list()).body).toEqual([])
  })

  it("quien no tiene nada, o tiene otro rol con filas antiguas, no recibe nada", async () => {
    for (const who of [SINCLASE, ALUMNO, EXTUTOR]) {
      as(who)
      expect((await list()).body, who.id).toEqual([])
    }
  })

  it("administración de otro centro no ve sesiones de este", async () => {
    as(ADMIN_C2)

    expect(ids((await list()).body)).toEqual([S_OTRO_CENTRO])
  })
})

describe("GET /api/cooperative/classes", () => {
  const classes = async () => {
    const res = await classesGET(new Request("http://localhost/api/cooperative/classes"))
    return (await res.json()) as string[]
  }

  beforeEach(() => {
    db.seed("students", [
      { id: "s1", process_id: P_PROPIO, current_class: "4PA", active: true },
      { id: "s2", process_id: P_PROPIO, current_class: "4PB", active: true },
      { id: "s3", process_id: P_AJENO, current_class: "6PA", active: true },
      { id: "s4", process_id: P_ASIGNADO, current_class: "5PA", active: true },
      { id: "s5", process_id: P_OTRO_CENTRO, current_class: "4PA", active: true },
    ])
  })

  it("un profesor recibe las clases que tutoriza y las que imparte", async () => {
    as(ROSA)
    expect(await classes()).toEqual(["1º ESO A", "4PA"])

    as(NOEMI)
    expect(await classes()).toEqual(["6PA"])

    as(SINCLASE)
    expect(await classes()).toEqual([])
  })

  it("administración recibe las clases con alumnado de los procesos de su centro", async () => {
    as(ADMIN)

    expect(await classes()).toEqual(["4PA", "4PB", "5PA", "6PA"])
  })

  it("otro rol no recibe clases por una asignación antigua a un proceso", async () => {
    as(EXTUTOR) // sigue en process_tutors de p-asignado

    expect(await classes()).toEqual([])
  })
})

describe("POST /api/cooperative", () => {
  // La ruta elige el proceso más reciente con alumnado activo en esa clase.
  const student = (id: string, processId: string, className: string, center = C1): Row => ({
    id,
    process_id: processId,
    current_class: className,
    active: true,
    "processes.center_id": center, // lo que el filtro `eq("processes.center_id")` compara
    processes: { center_id: center, id: processId, created_at: "2026-09-01" },
  })
  const create = (who: Profile, className: string) => {
    as(who)
    return sessionsPOST(jsonReq("POST", { class_name: className, name: "Sesión nueva" }))
  }
  const inserted = () => db.ops("group_sessions", "insert").length

  beforeEach(() => {
    db.seed("students", [
      student("s1", P_PROPIO, "4PA"),
      student("s2", P_PROPIO, "4PB"),
      student("s3", P_AJENO, "6PA"),
      student("s4", P_ASIGNADO, "5PA"),
      student("s5", P_ANTIGUO, "3PA"),
    ])
  })

  it("un profesor crea sesiones para la clase que tutoriza", async () => {
    expect((await create(ROSA, "4PA")).status).toBe(200)
    expect(inserted()).toBe(1)
  })

  it("y para la que imparte", async () => {
    expect((await create(NOEMI, "6PA")).status).toBe(200)
    expect((await create(TEO, "4PA")).status).toBe(200)
    expect(inserted()).toBe(2)
  })

  it("no para una clase que ni tutoriza ni imparte, aunque tenga el proceso", async () => {
    const res = await create(ROSA, "4PB") // tiene p-propio, pero no da ni tutoriza 4PB

    expect(res.status).toBe(403)
    expect(inserted()).toBe(0)
  })

  it("no para la clase de otro profesor", async () => {
    expect((await create(NOEMI, "4PA")).status).toBe(403)
    expect(inserted()).toBe(0)
  })

  it("no sobre un proceso de otro curso escolar por dar clase en un grupo que se llama igual", async () => {
    db.seed("students", [student("s6", P_ANTIGUO, "4PA")]) // solo hay alumnado de 4PA en el proceso anterior

    expect((await create(TEO, "4PA")).status).toBe(403)
    expect(inserted()).toBe(0)
  })

  it("otro rol con una asignación antigua no crea sesiones", async () => {
    const res = await create(EXTUTOR, "5PA")

    expect(res.status).toBe(403)
    expect(inserted()).toBe(0)
  })

  it("administración crea para cualquier clase de su centro", async () => {
    expect((await create(ADMIN, "6PA")).status).toBe(200)
  })
})

// ── Reglas de una sesión ─────────────────────────────────────────────────────

describe("reglas de una sesión cooperativa", () => {
  const list = async (who: Profile, sessionId: string) => {
    as(who)
    return (await rulesGET(new Request("http://localhost/api"), params({ sessionId }))).status
  }
  const create = async (who: Profile, sessionId: string) => {
    as(who)
    const res = await rulesPOST(
      jsonReq("POST", { rule_type: "must_separate", student_ids: ["a", "b"] }),
      params({ sessionId })
    )
    return res.status
  }
  const remove = async (who: Profile, sessionId: string, ruleId: string) => {
    as(who)
    const res = await ruleDELETE(new Request("http://localhost/api", { method: "DELETE" }), params({ sessionId, ruleId }))
    return res.status
  }

  const OPEN = 200
  const NOT_FOUND = 404

  it("un profesor ve las reglas de las sesiones de sus clases", async () => {
    expect(await list(ROSA, S_4PA_PROPIO)).toBe(OPEN) // tutoriza 4PA
    expect(await list(ROSA, S_4PA_ANTIGUO)).toBe(OPEN) // la tutoría no depende del curso
    expect(await list(NOEMI, S_6PA_AJENO)).toBe(OPEN) // da clase en 6PA
    expect(await list(TEO, S_4PA_PROPIO)).toBe(OPEN) // da clase en 4PA este curso
  })

  it("no las de otras clases, aunque tenga el proceso", async () => {
    expect(await list(ROSA, S_4PB_PROPIO)).toBe(NOT_FOUND)
    expect(await list(TEO, S_4PB_PROPIO)).toBe(NOT_FOUND)
    expect(await list(NOEMI, S_4PA_PROPIO)).toBe(NOT_FOUND)
  })

  it("dar clase en un grupo que se llama igual en otro curso escolar no abre la sesión de aquella cohorte", async () => {
    expect(await list(TEO, S_4PA_ANTIGUO)).toBe(NOT_FOUND)
  })

  it("quien solo tiene el proceso asignado, sin clase, tampoco", async () => {
    expect(await list(LUIS, S_5PA_ASIGNADO)).toBe(NOT_FOUND)
  })

  it("otro rol con filas antiguas o sin nada no entra", async () => {
    expect(await list(EXTUTOR, S_5PA_ASIGNADO)).toBe(NOT_FOUND)
    expect(await list(EXTUTOR, S_6PA_AJENO)).toBe(NOT_FOUND)
    expect(await list(ALUMNO, S_4PA_PROPIO)).toBe(NOT_FOUND)
    expect(await list(SINCLASE, S_4PA_PROPIO)).toBe(NOT_FOUND)
  })

  it("una sesión de otro centro no se abre, ni siquiera con acceso total en el propio", async () => {
    expect(await list(ADMIN, S_OTRO_CENTRO)).toBe(NOT_FOUND)
    expect(await list(ADMIN_C2, S_4PA_PROPIO)).toBe(NOT_FOUND)
  })

  it("administración abre cualquiera de su centro", async () => {
    expect(await list(ADMIN, S_4PB_PROPIO)).toBe(OPEN)
  })

  it("crear una regla exige el mismo acceso", async () => {
    expect(await create(TEO, S_4PB_PROPIO)).toBe(NOT_FOUND)
    expect(await create(EXTUTOR, S_5PA_ASIGNADO)).toBe(NOT_FOUND)
    expect(db.ops("cooperative_rules", "insert")).toEqual([])

    expect(await create(TEO, S_4PA_PROPIO)).toBe(OPEN)
    expect(db.ops("cooperative_rules", "insert")).toHaveLength(1)
  })

  describe("borrar una regla", () => {
    beforeEach(() => {
      const groupSession = (id: string, processId: string, className: string) => ({
        class_name: className,
        process_id: processId,
        processes: { center_id: C1 },
        id,
      })
      db.seed("cooperative_rules", [
        { id: "r-4pa", session_id: S_4PA_PROPIO, group_sessions: groupSession(S_4PA_PROPIO, P_PROPIO, "4PA") },
        { id: "r-4pb", session_id: S_4PB_PROPIO, group_sessions: groupSession(S_4PB_PROPIO, P_PROPIO, "4PB") },
        { id: "r-antigua", session_id: S_4PA_ANTIGUO, group_sessions: groupSession(S_4PA_ANTIGUO, P_ANTIGUO, "4PA") },
      ])
    })
    const remaining = () => ids(db.rows("cooperative_rules"))

    it("un profesor borra las de sus clases", async () => {
      expect(await remove(TEO, S_4PA_PROPIO, "r-4pa")).toBe(200)
      expect(remaining()).toEqual(["r-4pb", "r-antigua"])
    })

    it("no las de otras clases ni las de la cohorte anterior de un grupo que se llama igual", async () => {
      expect(await remove(TEO, S_4PB_PROPIO, "r-4pb")).toBe(403)
      expect(await remove(TEO, S_4PA_ANTIGUO, "r-antigua")).toBe(403)
      expect(remaining()).toEqual(["r-4pa", "r-4pb", "r-antigua"])
    })

    it("administración de otro centro no borra reglas de este", async () => {
      expect(await remove(ADMIN_C2, S_4PA_PROPIO, "r-4pa")).toBe(404)
      expect(remaining()).toHaveLength(3)
    })

    it("con otro rol no borra ninguna", async () => {
      expect(await remove(EXTUTOR, S_4PA_PROPIO, "r-4pa")).toBe(403)
      expect(remaining()).toHaveLength(3)
    })

    it("administración borra cualquiera de su centro", async () => {
      expect(await remove(ADMIN, S_4PB_PROPIO, "r-4pb")).toBe(200)
      expect(remaining()).toEqual(["r-4pa", "r-antigua"])
    })
  })
})
