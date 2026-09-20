import { describe, it, expect, vi, beforeEach } from "vitest"
import { getStudentAccessScope, getTeachingGroups, canSeeClass, type StudentAccessScope } from "@/lib/auth"
import { FakeSupabase } from "../helpers/fake-supabase"

let db: FakeSupabase

vi.mock("@/lib/supabase/server", () => ({ createServiceClient: () => db, createClient: vi.fn() }))
vi.mock("next/navigation", () => ({ redirect: vi.fn() }))

const CENTER = "c1"
const ME = "u-rosa"
const YEAR = "2026/2027"

const teaches = (userId: string, group: string, center = CENTER) => ({
  center_id: center,
  user_id: userId,
  group_name: group,
  school_year: YEAR,
})
const tutors = (userId: string, group: string, center = CENTER) => ({
  center_id: center,
  user_id: userId,
  group_name: group,
  school_year: YEAR,
})

beforeEach(() => {
  db = new FakeSupabase()
})

describe("getStudentAccessScope", () => {
  it.each(["admin", "superadmin", "orientador"])("%s ve todo el centro sin consultar nada", async (role) => {
    const scope = await getStudentAccessScope(CENTER, ME, role)

    expect(scope).toEqual({ all: true })
    expect(db.log).toHaveLength(0)
  })

  it("un tutor ve la unión de los grupos que tutoriza y los que imparte, sin repetidos", async () => {
    db.seed("group_tutors", [tutors(ME, "4PA"), tutors(ME, "1º ESO A")])
    db.seed("teacher_group_access", [teaches(ME, "1º ESO A"), teaches(ME, "1º ESO B")])

    const scope = await getStudentAccessScope(CENTER, ME, "tutor")

    expect(scope.all).toBe(false)
    expect([...(scope as { classes: string[] }).classes].sort()).toEqual(["1º ESO A", "1º ESO B", "4PA"])
  })

  it("un profesor (rol tutor) sin tutorías ve solo los grupos que imparte", async () => {
    db.seed("teacher_group_access", [teaches(ME, "1º ESO A")])

    expect(await getStudentAccessScope(CENTER, ME, "tutor")).toEqual({ all: false, classes: ["1º ESO A"] })
  })

  it("un tutor sin ningún grupo no ve nada", async () => {
    expect(await getStudentAccessScope(CENTER, ME, "tutor")).toEqual({ all: false, classes: [] })
  })

  it("no arrastra los grupos de otra persona ni de otro centro", async () => {
    db.seed("teacher_group_access", [teaches("u-luis", "4º ESO A"), teaches(ME, "1PA", "c2")])
    db.seed("group_tutors", [tutors("u-luis", "5PA"), tutors(ME, "6PA", "c2")])

    expect(await getStudentAccessScope(CENTER, ME, "tutor")).toEqual({ all: false, classes: [] })
  })

  it.each(["alumno", "profesor", "jefe_estudios", ""])(
    "el rol %j no ve alumnado aunque tenga filas de acceso",
    async (role) => {
      db.seed("teacher_group_access", [teaches(ME, "1º ESO A")])
      db.seed("group_tutors", [tutors(ME, "4PA")])

      expect(await getStudentAccessScope(CENTER, ME, role)).toEqual({ all: false, classes: [] })
    }
  )
})

describe("getTeachingGroups", () => {
  it("devuelve solo los grupos de esa persona en ese centro", async () => {
    db.seed("teacher_group_access", [
      teaches(ME, "1º ESO A"),
      teaches(ME, "1º ESO B"),
      teaches("u-luis", "4º ESO A"),
      teaches(ME, "1PA", "c2"),
    ])

    expect((await getTeachingGroups(CENTER, ME)).sort()).toEqual(["1º ESO A", "1º ESO B"])
  })

  it("sin filas devuelve una lista vacía", async () => {
    expect(await getTeachingGroups(CENTER, ME)).toEqual([])
  })
})

describe("canSeeClass", () => {
  const scoped: StudentAccessScope = { all: false, classes: ["1º ESO A", "4PA"] }

  it("quien lo ve todo puede ver cualquier grupo, también alumnado sin grupo", () => {
    expect(canSeeClass({ all: true }, "5PB")).toBe(true)
    expect(canSeeClass({ all: true }, null)).toBe(true)
    expect(canSeeClass({ all: true }, undefined)).toBe(true)
  })

  it("con ámbito limitado solo ve los grupos de la lista, con el nombre exacto", () => {
    expect(canSeeClass(scoped, "1º ESO A")).toBe(true)
    expect(canSeeClass(scoped, "4PA")).toBe(true)
    expect(canSeeClass(scoped, "1º ESO B")).toBe(false)
    expect(canSeeClass(scoped, "4pa")).toBe(false)
    expect(canSeeClass(scoped, "1º ESO")).toBe(false)
  })

  it("el alumnado sin grupo queda fuera del ámbito limitado", () => {
    expect(canSeeClass(scoped, null)).toBe(false)
    expect(canSeeClass(scoped, undefined)).toBe(false)
    expect(canSeeClass(scoped, "")).toBe(false)
  })

  it("un ámbito limitado y vacío no ve nada", () => {
    expect(canSeeClass({ all: false, classes: [] }, "1º ESO A")).toBe(false)
    expect(canSeeClass({ all: false, classes: [] }, null)).toBe(false)
  })
})
