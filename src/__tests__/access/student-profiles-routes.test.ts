import { describe, it, expect, vi, beforeEach } from "vitest"
import { getUserProfile } from "@/lib/auth"
import { GET as listGET, POST as createPOST } from "@/app/api/student-profiles/route"
import { GET as oneGET, PATCH as onePATCH, DELETE as oneDELETE } from "@/app/api/student-profiles/[id]/route"
import { GET as groupsGET } from "@/app/api/student-profiles/groups/route"
import { POST as importPOST } from "@/app/api/student-profiles/import/route"
import { FakeSupabase, type Row } from "../helpers/fake-supabase"

let db: FakeSupabase

vi.mock("@/lib/supabase/server", () => ({ createServiceClient: () => db, createClient: vi.fn() }))
vi.mock("next/navigation", () => ({ redirect: vi.fn() }))
// La sesión se simula (getUserProfile); las reglas de acceso (getStudentAccessScope, canSeeClass,
// hasFullAccess, getTutorGroups) son las reales y leen del doble de Supabase.
vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>()
  return { ...actual, getUserProfile: vi.fn(), logAudit: vi.fn() }
})

const C1 = "c1"
const C2 = "c2"
const YEAR = "2026/2027"

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
const ROSA = profileOf("u-rosa", "tutor") // da clase en 1º ESO A y tutoriza 4PA
const LUIS = profileOf("u-luis", "tutor") // profesor sin asignaciones
const ALUMNO = profileOf("u-alumno", "alumno")

function studentRow(id: string, first: string, cls: string | null, over: Row = {}): Row {
  return {
    id,
    center_id: C1,
    first_name: first,
    last_name: "García",
    external_id: `ext-${id}`,
    current_class: cls,
    gender: "F",
    needs_type: "No",
    academic_level: "Medio",
    school_year: YEAR,
    active: true,
    ...over,
  }
}

const as = (p: Profile | null) => vi.mocked(getUserProfile).mockResolvedValue(p as never)
const params = <T extends object>(p: T) => ({ params: Promise.resolve(p) })
const req = (path: string, init?: RequestInit) => new Request(`http://localhost${path}`, init)
const json = (body: unknown) => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
const patchJson = (body: unknown) => ({ method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
const stored = (id: string) => db.rows("student_profiles").find((r) => r.id === id)

beforeEach(() => {
  vi.clearAllMocks()
  db = new FakeSupabase()
  db.seed("student_profiles", [
    studentRow("s1", "Ana", "1º ESO A"),
    studentRow("s2", "Beatriz", "1º ESO A"),
    studentRow("s3", "Carla", "1º ESO B"),
    studentRow("s4", "Daniela", "4PA"),
    studentRow("s5", "Elena", "5PB"),
    studentRow("s6", "Flor", null),
    studentRow("s7", "Gala", "1º ESO A", { active: false }),
    studentRow("x1", "Otra", "1º ESO A", { center_id: C2 }),
  ])
  db.seed("teacher_group_access", [
    { center_id: C1, user_id: ROSA.id, group_name: "1º ESO A", school_year: YEAR },
    { center_id: C2, user_id: ROSA.id, group_name: "1º ESO A", school_year: YEAR },
  ])
  db.seed("group_tutors", [{ center_id: C1, user_id: ROSA.id, group_name: "4PA", school_year: YEAR }])
  db.seed("center_groups", [
    { center_id: C1, name: "1º ESO A", school_year: YEAR },
    { center_id: C1, name: "1º ESO B", school_year: YEAR },
    { center_id: C1, name: "4PA", school_year: YEAR },
    { center_id: C1, name: "5PB", school_year: YEAR },
    { center_id: C1, name: "6PA", school_year: YEAR },
    { center_id: C2, name: "OtroCentro", school_year: YEAR },
  ])
  as(ROSA)
})

// ── GET /api/student-profiles ────────────────────────────────────────────────

describe("GET /api/student-profiles", () => {
  const list = async (query = "") => {
    const res = await listGET(req(`/api/student-profiles${query}`))
    return { status: res.status, body: (await res.json()) as { profiles: Row[]; total: number } }
  }
  const ids = (b: { profiles: Row[] }) => b.profiles.map((p) => p.id).sort()

  it("sin sesión responde 401", async () => {
    as(null)
    expect((await listGET(req("/api/student-profiles"))).status).toBe(401)
  })

  it("un profesor ve solo el alumnado activo de los grupos que imparte o tutoriza", async () => {
    const { status, body } = await list()

    expect(status).toBe(200)
    expect(ids(body)).toEqual(["s1", "s2", "s4"]) // 1º ESO A + 4PA; sin 1º ESO B, 5PB, sin grupo, baja ni otro centro
    expect(body.total).toBe(3)
  })

  it("filtrar por un grupo ajeno no lo abre", async () => {
    const { body } = await list("?class=1%C2%BA%20ESO%20B")

    expect(body.profiles).toEqual([])
    expect(body.total).toBe(0)
  })

  it("filtrar por un grupo propio devuelve solo ese grupo", async () => {
    const { body } = await list("?class=4PA")

    expect(ids(body)).toEqual(["s4"])
  })

  it("la búsqueda por nombre no encuentra alumnado de grupos ajenos", async () => {
    expect(ids((await list("?q=Carla")).body)).toEqual([])
    expect(ids((await list("?q=Ana")).body)).toEqual(["s1"])
  })

  it("incluir inactivos no amplía los grupos visibles", async () => {
    const { body } = await list("?include_inactive=true")

    expect(ids(body)).toEqual(["s1", "s2", "s4", "s7"]) // s7 es baja pero de un grupo suyo
  })

  it("un profesor sin grupos ve la lista vacía sin consultar alumnado", async () => {
    as(LUIS)

    const { body } = await list()

    expect(body).toEqual({ profiles: [], total: 0 })
    expect(db.ops("student_profiles", "select")).toHaveLength(0)
  })

  it("un rol sin acceso (alumno) no ve fichas", async () => {
    as(ALUMNO)

    expect((await list()).body).toEqual({ profiles: [], total: 0 })
  })

  it.each([ADMIN, ORIENTADOR])("$role ve todo el alumnado activo de su centro y nada de otros", async (who) => {
    as(who)

    const { body } = await list()

    expect(ids(body)).toEqual(["s1", "s2", "s3", "s4", "s5", "s6"])
  })
})

// ── GET /api/student-profiles/[id] ───────────────────────────────────────────

describe("GET /api/student-profiles/[id]", () => {
  const one = async (id: string) => oneGET(req(`/api/student-profiles/${id}`), params({ id }))

  it("un profesor abre la ficha de un alumno de su grupo", async () => {
    const res = await one("s1")

    expect(res.status).toBe(200)
    expect(((await res.json()) as { profile: Row }).profile.id).toBe("s1")
  })

  it("una ficha de un grupo ajeno responde 404, igual que una que no existe", async () => {
    const foreign = await one("s3")
    const missing = await one("no-existe")

    expect(foreign.status).toBe(404)
    expect(await foreign.json()).toEqual(await missing.json())
  })

  it("una ficha sin grupo no es visible para un profesor", async () => {
    expect((await one("s6")).status).toBe(404)
  })

  it("no se abre la ficha de otro centro ni siquiera con permisos completos", async () => {
    as(ADMIN)

    expect((await one("x1")).status).toBe(404)
  })

  it("un administrador abre cualquier ficha de su centro, con o sin grupo", async () => {
    as(ADMIN)

    expect((await one("s3")).status).toBe(200)
    expect((await one("s6")).status).toBe(200)
  })

  it("un profesor sin grupos no abre ninguna ficha", async () => {
    as(LUIS)

    expect((await one("s1")).status).toBe(404)
  })

  describe("trayectoria (participación en procesos)", () => {
    const process = (id: string) => ({ id, name: `Proceso ${id}`, school_year: "2026-2027", status: "en_analisis", target_level: null })
    const trajectoryOf = async (id: string) =>
      ((await (await one(id)).json()) as { trajectory: { student: { id: string } }[] }).trajectory.map((t) => t.student.id)

    beforeEach(() => {
      db.seed("processes", [
        { ...process("p-suyo"), center_id: C1, source_groups: ["4PA"] }, // Rosa tutoriza 4PA
        { ...process("p-ajeno"), center_id: C1, source_groups: ["6PA"] },
      ])
      // s1 (1º ESO A) participó en un proceso de Rosa y en otro que no es suyo
      db.seed("students", [
        { id: "e1", student_profile_id: "s1", process_id: "p-suyo", created_at: "2026-09-01", processes: process("p-suyo") },
        { id: "e2", student_profile_id: "s1", process_id: "p-ajeno", created_at: "2026-09-02", processes: process("p-ajeno") },
      ])
      db.seed("sociogram_metrics", [
        { student_id: "e1", received_count: 3 },
        { student_id: "e2", received_count: 9 },
      ])
    })

    it("un profesor solo ve la participación en procesos a los que tiene acceso", async () => {
      expect(await trajectoryOf("s1")).toEqual(["e1"])
    })

    it("no se consultan las métricas de los procesos ajenos", async () => {
      await one("s1")

      expect(db.ops("sociogram_metrics", "select")).toHaveLength(1) // solo la de e1
      expect(db.ops("proposal_assignments", "select")).toHaveLength(1)
    })

    it("un profesor que solo da clase al alumno (sin procesos) recibe la trayectoria vacía y sin consultas", async () => {
      db.rows("teacher_group_access").push({ center_id: C1, user_id: LUIS.id, group_name: "1º ESO A", school_year: YEAR })
      as(LUIS)

      expect(await trajectoryOf("s1")).toEqual([])
      expect(db.ops("sociogram_metrics", "select")).toHaveLength(0)
    })

    it.each([ADMIN, ORIENTADOR])("$role ve la trayectoria completa", async (who) => {
      as(who)

      expect(await trajectoryOf("s1")).toEqual(["e1", "e2"])
    })
  })
})

// ── PATCH /api/student-profiles/[id] ─────────────────────────────────────────

describe("PATCH /api/student-profiles/[id]", () => {
  const patch = (id: string, body: object) => onePATCH(req(`/api/student-profiles/${id}`, patchJson(body)), params({ id }))

  it("un profesor edita a un alumno de su grupo", async () => {
    const res = await patch("s1", { observations: "Nota" })

    expect(res.status).toBe(200)
    expect(stored("s1")?.observations).toBe("Nota")
  })

  it("un profesor no puede editar a alguien de un grupo ajeno", async () => {
    const res = await patch("s3", { observations: "Nota" })

    expect(res.status).toBe(404)
    expect(stored("s3")?.observations).toBeUndefined()
  })

  it("no puede sacar a un alumno suyo a un grupo ajeno", async () => {
    const res = await patch("s1", { current_class: "1º ESO B" })

    expect(res.status).toBe(403)
    expect(stored("s1")?.current_class).toBe("1º ESO A")
  })

  it("no puede dejar a un alumno sin grupo (saldría de su vista)", async () => {
    const res = await patch("s1", { current_class: null })

    expect(res.status).toBe(403)
    expect(stored("s1")?.current_class).toBe("1º ESO A")
  })

  it("puede pasarlo a otro de sus grupos", async () => {
    const res = await patch("s1", { current_class: "4PA" })

    expect(res.status).toBe(200)
    expect(stored("s1")?.current_class).toBe("4PA")
  })

  it("la escritura lleva además el filtro de grupos por si el alumno cambió de grupo entre la lectura y la escritura", async () => {
    await patch("s1", { observations: "Nota" })

    const write = db.ops("student_profiles", "update")[0]
    expect(write.filters).toContain("in:current_class")
  })

  it("un profesor sin grupos no edita nada", async () => {
    as(LUIS)

    expect((await patch("s1", { observations: "Nota" })).status).toBe(404)
    expect(stored("s1")?.observations).toBeUndefined()
  })

  it("un administrador edita y mueve a cualquier grupo, sin el filtro de grupos", async () => {
    as(ADMIN)

    const res = await patch("s3", { current_class: "6PA" })

    expect(res.status).toBe(200)
    expect(stored("s3")?.current_class).toBe("6PA")
    expect(db.ops("student_profiles", "update")[0].filters).not.toContain("in:current_class")
  })

  it("un administrador no toca fichas de otro centro", async () => {
    as(ADMIN)

    await patch("x1", { observations: "Nota" })

    expect(stored("x1")?.observations).toBeUndefined()
  })

  it("el grupo se guarda recortado (la comparación de acceso es por texto exacto)", async () => {
    as(ADMIN)

    expect((await patch("s3", { current_class: "  6PA " })).status).toBe(200)
    expect(stored("s3")?.current_class).toBe("6PA")

    expect((await patch("s3", { current_class: "   " })).status).toBe(200)
    expect(stored("s3")?.current_class).toBeNull()
  })

  it("un profesor que escribe su grupo con espacios sobrantes no se sale de su vista", async () => {
    expect((await patch("s1", { current_class: " 4PA " })).status).toBe(200)
    expect(stored("s1")?.current_class).toBe("4PA")
  })

  it("un nombre repetido en el centro responde 409 sin filtrar el detalle de la base de datos", async () => {
    db.failNext["student_profiles:update"] = {
      code: "23505",
      message: 'duplicate key value violates unique constraint "student_profiles_name_unique"',
    }

    const res = await patch("s1", { first_name: "Beatriz" })
    const body = (await res.json()) as { error: string }

    expect(res.status).toBe(409)
    expect(body.error).not.toContain("student_profiles_name_unique")
  })

  it("otros fallos de escritura siguen siendo 500", async () => {
    db.failNext["student_profiles:update"] = { code: "XX000", message: "boom" }

    expect((await patch("s1", { observations: "Nota" })).status).toBe(500)
  })
})

// ── DELETE /api/student-profiles/[id] ────────────────────────────────────────

describe("DELETE /api/student-profiles/[id]", () => {
  const del = (id: string, permanent = false) =>
    oneDELETE(req(`/api/student-profiles/${id}${permanent ? "?permanent=true" : ""}`, { method: "DELETE" }), params({ id }))

  it("un profesor da de baja a un alumno de su grupo", async () => {
    const res = await del("s1")

    expect(res.status).toBe(200)
    expect(stored("s1")?.active).toBe(false)
  })

  it("no puede dar de baja a nadie de un grupo ajeno", async () => {
    const res = await del("s3")

    expect(res.status).toBe(404)
    expect(stored("s3")?.active).toBe(true)
  })

  it("la baja lleva además el filtro de grupos en la propia escritura", async () => {
    await del("s1")

    expect(db.ops("student_profiles", "update")[0].filters).toContain("in:current_class")
  })

  it("un profesor sin grupos no da de baja a nadie", async () => {
    as(LUIS)

    expect((await del("s1")).status).toBe(404)
    expect(stored("s1")?.active).toBe(true)
  })

  it("un profesor no puede eliminar definitivamente ninguna ficha, ni activa ni de baja, aunque sea de su grupo", async () => {
    expect((await del("s1", true)).status).toBe(403) // activa
    expect((await del("s7", true)).status).toBe(403) // ya dada de baja

    expect(stored("s1")).toBeDefined()
    expect(stored("s7")).toBeDefined()
    expect(db.ops("student_profiles", "delete")).toHaveLength(0)
    expect(db.ops("students", "update")).toHaveLength(0)
  })

  it("el borrado definitivo en un grupo ajeno responde 404 (no revela si existe)", async () => {
    db.rows("student_profiles").push(studentRow("s8", "Hugo", "1º ESO B", { active: false }))

    expect((await del("s8", true)).status).toBe(404)
    expect(stored("s8")).toBeDefined()
  })

  it.each([ADMIN, ORIENTADOR])("$role solo elimina definitivamente fichas ya dadas de baja", async (who) => {
    as(who)

    expect((await del("s1", true)).status).toBe(400) // activa
    expect(stored("s1")).toBeDefined()

    expect((await del("s7", true)).status).toBe(200)
    expect(stored("s7")).toBeUndefined()
  })

  it("el borrado definitivo no alcanza a otro centro ni con permisos completos", async () => {
    db.rows("student_profiles").push(studentRow("x2", "Ines", "1º ESO A", { center_id: C2, active: false }))
    as(ADMIN)

    expect((await del("x2", true)).status).toBe(404)
    expect(stored("x2")).toBeDefined()
  })

  it("un administrador da de baja a cualquiera de su centro, sin filtro de grupos", async () => {
    as(ADMIN)

    expect((await del("s3")).status).toBe(200)
    expect(stored("s3")?.active).toBe(false)
    expect(db.ops("student_profiles", "update")[0].filters).not.toContain("in:current_class")
  })
})

// ── POST /api/student-profiles ───────────────────────────────────────────────

describe("POST /api/student-profiles", () => {
  const create = (body: object) => createPOST(req("/api/student-profiles", json(body)))
  const base = { first_name: "Nuevo", last_name: "Alumno" }
  const inserted = () => db.ops("student_profiles", "insert")

  it("un profesor da de alta alumnado en un grupo suyo", async () => {
    const res = await create({ ...base, current_class: "1º ESO A" })

    expect(res.status).toBe(201)
    expect(db.rows("student_profiles").some((r) => r.first_name === "Nuevo" && r.center_id === C1)).toBe(true)
  })

  it("no puede darlo de alta en un grupo ajeno", async () => {
    const res = await create({ ...base, current_class: "1º ESO B" })

    expect(res.status).toBe(403)
    expect(inserted()).toHaveLength(0)
  })

  it("no puede darlo de alta sin grupo", async () => {
    expect((await create(base)).status).toBe(403)
    expect((await create({ ...base, current_class: "  " })).status).toBe(403)
    expect(inserted()).toHaveLength(0)
  })

  it("el grupo se compara recortado, como se guarda", async () => {
    expect((await create({ ...base, current_class: " 1º ESO A " })).status).toBe(201)
    expect((await create({ ...base, first_name: "Otro", current_class: " 1º ESO B " })).status).toBe(403)
  })

  it("un administrador da de alta en cualquier grupo o sin grupo", async () => {
    as(ADMIN)

    expect((await create({ ...base, current_class: "1º ESO B" })).status).toBe(201)
    expect((await create({ ...base, first_name: "SinGrupo" })).status).toBe(201)
  })

  it("los datos obligatorios se validan antes que los permisos", async () => {
    expect((await create({ first_name: "", last_name: "X", current_class: "1º ESO A" })).status).toBe(400)
  })

  it("un nombre repetido en el centro responde 409 sin filtrar el detalle de la base de datos", async () => {
    db.failNext["student_profiles:insert"] = {
      code: "23505",
      message: 'duplicate key value violates unique constraint "student_profiles_name_unique"',
    }

    const res = await create({ ...base, current_class: "1º ESO A" })
    const body = (await res.json()) as { error: string }

    expect(res.status).toBe(409)
    expect(body.error).not.toContain("student_profiles_name_unique")
  })
})

// ── GET /api/student-profiles/groups ─────────────────────────────────────────

describe("GET /api/student-profiles/groups", () => {
  const groups = async () => {
    const res = await groupsGET()
    return { status: res.status, body: (await res.json()) as { name: string; count: number; mine: boolean }[] }
  }

  it("un profesor solo recibe sus grupos, con sus recuentos y marcados como suyos", async () => {
    const { body } = await groups()

    expect(body.map((g) => g.name)).toEqual(["1º ESO A", "4PA"])
    expect(body.every((g) => g.mine)).toBe(true)
    expect(body.find((g) => g.name === "4PA")?.count).toBe(1)
  })

  it("no filtra grupos registrados de otros cursos aunque estén vacíos", async () => {
    const names = (await groups()).body.map((g) => g.name)

    expect(names).not.toContain("6PA")
    expect(names).not.toContain("1º ESO B")
    expect(names).not.toContain("OtroCentro")
  })

  it("un profesor sin grupos recibe una lista vacía", async () => {
    as(LUIS)

    expect((await groups()).body).toEqual([])
  })

  it("un administrador ve todos los grupos del centro; solo son suyos los que tutoriza", async () => {
    as(ADMIN)

    const { body } = await groups()

    expect(body.map((g) => g.name)).toEqual(["1º ESO A", "1º ESO B", "4PA", "5PB", "6PA"])
    expect(body.some((g) => g.mine)).toBe(false)
  })

  it("un administrador que tutoriza un grupo lo ve como suyo", async () => {
    as(ADMIN)
    db.seed("group_tutors", [
      {
        center_id: C1,
        user_id: ADMIN.id,
        group_name: "6PA",
        school_year: YEAR,
        users: { id: ADMIN.id, name: "Admin", email: ADMIN.email },
      },
    ])

    const { body } = await groups()

    expect(body.filter((g) => g.mine).map((g) => g.name)).toEqual(["6PA"])
  })

  it("sin sesión responde 401", async () => {
    as(null)

    expect((await groupsGET()).status).toBe(401)
  })
})

// ── POST /api/student-profiles/import ────────────────────────────────────────

describe("POST /api/student-profiles/import", () => {
  const importAs = async (p: Profile | null) => {
    as(p)
    return importPOST(req("/api/student-profiles/import", { method: "POST", body: new FormData() }))
  }

  it("un profesor no puede importar alumnado masivamente", async () => {
    expect((await importAs(ROSA)).status).toBe(403)
    expect(db.log).toHaveLength(0)
  })

  it("sin sesión responde 401", async () => {
    expect((await importAs(null)).status).toBe(401)
  })

  it.each([ADMIN, ORIENTADOR])("$role pasa el control de permisos (falla solo por falta de archivo)", async (who) => {
    expect((await importAs(who)).status).toBe(400)
  })
})
