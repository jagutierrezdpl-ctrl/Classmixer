import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { getCenterInfo, getTeacherSubjects, type EduplataformaTeacherAssignment } from "@/lib/eduplataforma/client"

const HUB = "hub-center-1"

const page = (n: number, from = 0): EduplataformaTeacherAssignment[] =>
  Array.from({ length: n }, (_, i) => ({ teacher_id: `t${from + i}`, group_name: "1º ESO A", school_year: "2026/2027" }))

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body, text: async () => "" })
const fail = (status: number, text = "") => ({ ok: false, status, json: async () => ({}), text: async () => text })

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubEnv("EDUPLATFORMA_BASE_URL", "https://hub.test")
  vi.stubEnv("EDUPLATFORMA_SECRET", "unit-test-secret")
  vi.stubGlobal("fetch", fetchMock)
  fetchMock.mockReset()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

const urls = () => fetchMock.mock.calls.map((c) => new URL(String(c[0])))

describe("getCenterInfo", () => {
  it("pide el centro al hub y devuelve su curso activo", async () => {
    fetchMock.mockResolvedValue(ok({ center: { id: HUB, name: "Colegio", active_school_year: "2026/2027" } }))

    const info = await getCenterInfo(HUB)

    expect(info).toEqual({ id: HUB, name: "Colegio", active_school_year: "2026/2027" })
    expect(urls()[0].pathname).toBe(`/api/center/${HUB}`)
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toMatch(/^Bearer [\w-]+\.[\w-]+\.[\w-]+$/)
  })

  it("un error del hub se propaga con la ruta y el estado", async () => {
    fetchMock.mockResolvedValue(fail(404, "center_not_found"))

    await expect(getCenterInfo(HUB)).rejects.toThrow(`/api/center/${HUB} -> 404`)
  })
})

describe("getTeacherSubjects", () => {
  it("pide el curso indicado con el máximo de filas por página", async () => {
    fetchMock.mockResolvedValue(ok({ assignments: page(2), has_more: false }))

    const out = await getTeacherSubjects(HUB, "2026/2027")

    expect(out).toHaveLength(2)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const u = urls()[0]
    expect(u.pathname).toBe(`/api/center/${HUB}/teacher-subjects`)
    expect(u.searchParams.get("school_year")).toBe("2026/2027")
    expect(u.searchParams.get("limit")).toBe("5000")
    expect(u.searchParams.get("offset")).toBe("0")
  })

  it("sigue pidiendo páginas mientras el hub diga que hay más y las concatena", async () => {
    fetchMock
      .mockResolvedValueOnce(ok({ assignments: page(3, 0), has_more: true }))
      .mockResolvedValueOnce(ok({ assignments: page(2, 3), has_more: false }))

    const out = await getTeacherSubjects(HUB, "2026/2027")

    expect(out.map((a) => a.teacher_id)).toEqual(["t0", "t1", "t2", "t3", "t4"])
    expect(urls().map((u) => u.searchParams.get("offset"))).toEqual(["0", "5000"])
  })

  it("una página vacía corta el bucle aunque el hub siga diciendo que hay más", async () => {
    fetchMock.mockResolvedValue(ok({ assignments: [], has_more: true }))

    expect(await getTeacherSubjects(HUB, "2026/2027")).toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("un error del hub se propaga en lugar de devolver una lista parcial", async () => {
    fetchMock.mockResolvedValueOnce(ok({ assignments: page(1), has_more: true })).mockResolvedValueOnce(fail(500, "boom"))

    await expect(getTeacherSubjects(HUB, "2026/2027")).rejects.toThrow("-> 500")
  })

  it("codifica el curso escolar en la URL", async () => {
    fetchMock.mockResolvedValue(ok({ assignments: [], has_more: false }))

    await getTeacherSubjects(HUB, "2026/2027")

    expect(String(fetchMock.mock.calls[0][0])).toContain("school_year=2026%2F2027")
  })
})
