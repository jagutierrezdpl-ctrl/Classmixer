import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { GET } from "@/app/auth/from-platform/route"
import { verifyPlatformToken, type PlatformToken } from "@/lib/eduplataforma/token"
import { syncCenter, getOrCreateAuthUserId } from "@/lib/eduplataforma/sync"
import { syncTeacherAccess } from "@/lib/eduplataforma/teacher-access"
import { FakeSupabase } from "../helpers/fake-supabase"

let db: FakeSupabase & { auth?: unknown }

vi.mock("@/lib/supabase/server", () => ({ createServiceClient: () => db }))
vi.mock("@/lib/eduplataforma/token", () => ({ verifyPlatformToken: vi.fn() }))
vi.mock("@/lib/eduplataforma/teacher-access", () => ({ syncTeacherAccess: vi.fn() }))
// mapStaffRole es la real (es lo que decide quién entra y con qué rol); la sincronización se simula.
vi.mock("@/lib/eduplataforma/sync", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/eduplataforma/sync")>()
  return { ...actual, syncCenter: vi.fn(), getOrCreateAuthUserId: vi.fn() }
})

const HUB_CENTER = "hub-center-1"
const CM_CENTER = "cm-center-1"
const ORIGIN = "http://localhost"
const RESULT = { staff: 1, students: 1, groups: 1, skipped: 0, linksPending: 0 }
const ACCESS = { schoolYear: "2026/2027", users: 1, rows: 2, unmatched: 0 }

function token(role: string, over: Partial<PlatformToken> = {}): PlatformToken {
  return {
    email: "rosa@centro.es",
    name: "Rosa",
    eduplataforma_center_id: HUB_CENTER,
    eduplataforma_center_name: "Colegio",
    eduplataforma_user_id: "hub-user-1",
    eduplataforma_member_id: null,
    active_school_year: "2026/2027",
    role,
    secondary_roles: [],
    exp: Math.floor(Date.now() / 1000) + 60,
    ...over,
  }
}

const login = async (role: string, over: Partial<PlatformToken> = {}) => {
  vi.mocked(verifyPlatformToken).mockReturnValue(token(role, over))
  const res = await GET(new Request(`${ORIGIN}/auth/from-platform?token=t`))
  return res.headers.get("location") ?? ""
}
const lastSyncedAgo = (ms: number | null) => {
  db.rows("centers")[0].last_synced_at = ms === null ? null : new Date(Date.now() - ms).toISOString()
}
const MIN = 60 * 1000

beforeEach(() => {
  vi.clearAllMocks()
  db = new FakeSupabase()
  db.auth = {
    admin: { generateLink: async () => ({ data: { properties: { hashed_token: "hashed" } }, error: null }) },
  }
  db.seed("centers", [{ id: CM_CENTER, eduplataforma_center_id: HUB_CENTER, last_synced_at: null }])
  vi.mocked(getOrCreateAuthUserId).mockResolvedValue("auth-1")
  vi.mocked(syncCenter).mockResolvedValue({ ...RESULT, teacherAccess: ACCESS })
  vi.mocked(syncTeacherAccess).mockResolvedValue(ACCESS)
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("SSO desde EduPlataforma — quién entra", () => {
  it.each(["profesor", "tutor"])("el rol %s entra como tutor", async (role) => {
    const location = await login(role)

    expect(location).toContain("/api/auth/callback")
    expect(db.rows("users")[0]).toMatchObject({ role: "tutor", email: "rosa@centro.es", center_id: CM_CENTER })
  })

  it.each(["alumno", "familia", "pas", "jefe_estudios"])("el rol %s no entra y no se sincroniza nada", async (role) => {
    const location = await login(role)

    expect(location).toBe(`${ORIGIN}/login?error=no_access`)
    expect(db.log).toHaveLength(0)
    expect(syncCenter).not.toHaveBeenCalled()
    expect(syncTeacherAccess).not.toHaveBeenCalled()
  })
})

describe("SSO desde EduPlataforma — acceso del profesorado al entrar", () => {
  it("con la sincronización completa reciente, refresca al menos el acceso de quien entra", async () => {
    lastSyncedAgo(2 * MIN)

    await login("profesor")

    expect(syncCenter).not.toHaveBeenCalled()
    expect(syncTeacherAccess).toHaveBeenCalledTimes(1)
    expect(syncTeacherAccess).toHaveBeenCalledWith({
      classmixerCenterId: CM_CENTER,
      hubCenterId: HUB_CENTER,
      onlyEmail: "rosa@centro.es",
    })
  })

  it("si la sincronización completa ya dejó fijado el acceso, no lo repite", async () => {
    lastSyncedAgo(null)

    await login("profesor")

    expect(syncCenter).toHaveBeenCalledWith(CM_CENTER)
    expect(syncTeacherAccess).not.toHaveBeenCalled()
  })

  it("si la sincronización completa no pudo fijar el acceso (devuelve null), lo refresca aparte", async () => {
    lastSyncedAgo(null)
    vi.mocked(syncCenter).mockResolvedValue({ ...RESULT, teacherAccess: null })

    await login("profesor")

    expect(syncTeacherAccess).toHaveBeenCalledTimes(1)
  })

  it("si la sincronización completa falla, entra igualmente y refresca su acceso", async () => {
    lastSyncedAgo(null)
    vi.mocked(syncCenter).mockRejectedValue(new Error("hub caído"))

    const location = await login("profesor")

    expect(location).toContain("/api/auth/callback")
    expect(syncTeacherAccess).toHaveBeenCalledTimes(1)
  })

  it("si el refresco de su acceso falla, entra igualmente", async () => {
    lastSyncedAgo(2 * MIN)
    vi.mocked(syncTeacherAccess).mockRejectedValue(new Error("boom"))

    const location = await login("profesor")

    expect(location).toContain("/api/auth/callback")
    expect(vi.mocked(console.error).mock.calls.flat().join(" ")).toContain("boom")
  })

  it("la sincronización completa vuelve a correr pasados 15 minutos", async () => {
    lastSyncedAgo(16 * MIN)

    await login("profesor")

    expect(syncCenter).toHaveBeenCalledTimes(1)
  })

  it.each(["admin", "director_general", "orientador"])(
    "quien ve todo el centro (%s) no necesita refrescar acceso por docencia",
    async (role) => {
      lastSyncedAgo(2 * MIN)

      await login(role)

      expect(syncTeacherAccess).not.toHaveBeenCalled()
    }
  )
})
