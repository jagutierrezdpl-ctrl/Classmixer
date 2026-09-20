import { createServiceClient } from "@/lib/supabase/server"
import {
  getUsers,
  getMembers,
  getGroupMemberships,
  postMemberLink,
  type EduplataformaMember,
} from "@/lib/eduplataforma/client"
import { syncTeacherAccess, type TeacherAccessResult } from "@/lib/eduplataforma/teacher-access"

// Alumnado: tamaño de lote de los upserts masivos y límites al avisar al hub de las fichas
// nuevas (el aviso es informativo; no debe alargar el login por SSO, que espera la sync).
const STUDENT_CHUNK = 200
const LINK_CONCURRENCY = 12
const LINK_BUDGET_MS = 10_000

// Mapea el rol de sistema de EduPlataforma al rol de ClassMixer.
// Alumno/familia/pas/superadmin/foundation_admin no tienen cuenta de personal
// en ClassMixer (no gestionan agrupaciones/sociogramas).
// El profesorado (`profesor`) entra con el rol `tutor`, el único de ClassMixer que ve solo
// una parte del centro: qué grupos ve lo decide getStudentAccessScope (lib/auth) a partir de
// sus asignaciones docentes en EduPlataforma, no el rol.
export function mapStaffRole(role: string, secondaryRoles: string[]): "admin" | "orientador" | "tutor" | null {
  const roles = [role, ...secondaryRoles]
  if (roles.includes("admin") || roles.includes("director_general")) return "admin"
  if (roles.includes("orientador")) return "orientador"
  if (roles.includes("tutor") || roles.includes("profesor")) return "tutor"
  return null
}

// Busca (o crea) el usuario de Supabase Auth para un email dado y devuelve su id.
// Se usa tanto en el pull masivo de personal como en el login SSO de una sola persona.
export async function getOrCreateAuthUserId(email: string, name: string): Promise<string> {
  const supabase = createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle()
  if (existing?.id) return existing.id as string

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { name },
  })

  if (!createError && created.user) return created.user.id

  // El email ya existe en auth.users pero no en public.users (alta manual previa, etc).
  // Fallback: buscar por email paginando listUsers.
  for (let page = 1; page <= 10; page++) {
    const { data: list } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    const match = list?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
    if (match) return match.id
    if (!list || list.users.length < 200) break
  }

  throw new Error(`No se pudo crear ni encontrar el usuario Auth para ${email}`)
}

interface ProfileRow {
  id: string
  external_id: string | null
  first_name: string
  last_name: string | null
  email: string | null
}

interface SavedProfile {
  id: string
  external_id: string
}

export interface SyncResult {
  staff: number
  students: number
  groups: number
  skipped: number
  linksPending: number
  // null: no se pudo sincronizar el acceso del profesorado (o el centro no está vinculado).
  teacherAccess: TeacherAccessResult | null
}

const nameKey = (first: string, last: string | null | undefined) => `${first}\u0000${last ?? ""}`

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

// Errores de datos o de integridad (clases 22 y 23 de Postgres): afectan a una fila concreta,
// no a la conexión, así que se pueden aislar y seguir con el resto.
const isRowLevelError = (error: { code?: string }) => /^2[23]/.test(error.code ?? "")

// Fichas actuales del centro. PostgREST devuelve como mucho 1000 filas por petición: se pagina.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchProfiles(supabase: any, centerId: string): Promise<ProfileRow[]> {
  const rows: ProfileRow[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("student_profiles")
      .select("id, external_id, first_name, last_name, email")
      .eq("center_id", centerId)
      .order("id")
      .range(from, from + 999)
    if (error) throw new Error(`Sync alumnado (lectura): ${error.message}`)
    rows.push(...((data ?? []) as ProfileRow[]))
    if (!data || data.length < 1000) break
  }
  return rows
}

// Upsert por lotes. Un lote se aplica entero o no se aplica: si falla por una fila concreta se
// reintenta ficha a ficha para omitir solo esa y guardar el resto. Cualquier otro error
// (BD caída, permisos…) sí aborta la sincronización.
async function writeProfiles(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  rows: Record<string, unknown>[],
  onConflict: string
): Promise<{ saved: SavedProfile[]; failed: number }> {
  const saved: SavedProfile[] = []
  let failed = 0

  const upsert = (batch: Record<string, unknown>[]) =>
    supabase.from("student_profiles").upsert(batch, { onConflict }).select("id, external_id")

  for (const batch of chunk(rows, STUDENT_CHUNK)) {
    const res = await upsert(batch)
    if (!res.error) {
      saved.push(...(res.data as SavedProfile[]))
      continue
    }
    if (!isRowLevelError(res.error)) throw new Error(`Sync alumnado: ${res.error.message}`)

    for (const row of batch) {
      const one = await upsert([row])
      if (!one.error) {
        saved.push(...(one.data as SavedProfile[]))
        continue
      }
      if (!isRowLevelError(one.error)) throw new Error(`Sync alumnado: ${one.error.message}`)
      failed++
      console.error(`[sync] alumno ${String(row.external_id)} omitido: ${one.error.message}`)
    }
  }
  return { saved, failed }
}

// Vuelca el alumnado del hub en student_profiles. Cada alumno se casa con una ficha existente:
//  1. por el id de EduPlataforma (external_id), si ya se había sincronizado; o, si no,
//  2. por nombre y apellidos, "adoptando" la ficha importada a mano (external_id numérico del
//     Excel). Hay un índice único (center_id, first_name, last_name): insertar otra ficha con el
//     mismo nombre falla, y antes eso abortaba toda la sincronización en el primer alumno repetido.
// Al adoptar se conserva lo que ya hay en la ficha (género, nivel, observaciones…) y solo se
// actualiza lo que viene del hub. Si la ficha con ese nombre pertenece a otro alumno activo del
// hub (homónimo real), no se toca y el alumno se omite.
async function syncStudents(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  centerId: string,
  students: EduplataformaMember[]
): Promise<{ saved: number; skipped: number; links: { member_id: string; external_id: string }[] }> {
  if (students.length === 0) return { saved: 0, skipped: 0, links: [] }

  const existing = await fetchProfiles(supabase, centerId)
  const byExternal = new Map<string, ProfileRow>()
  const byName = new Map<string, ProfileRow>()
  for (const row of existing) {
    if (row.external_id) byExternal.set(row.external_id, row)
    byName.set(nameKey(row.first_name, row.last_name), row)
  }

  const hubIds = new Set(students.map((s) => s.id))
  const claimed = new Set<string>()
  const updates: Record<string, unknown>[] = []
  const inserts: Record<string, unknown>[] = []
  const needsLink = new Set<string>()

  for (const student of students) {
    let row = byExternal.get(student.id)
    let adopted = false

    if (!row) {
      const candidate = byName.get(nameKey(student.first_name, student.last_name))
      const ownedByOtherHubStudent = !!candidate?.external_id && hubIds.has(candidate.external_id)
      if (candidate && !claimed.has(candidate.id) && !ownedByOtherHubStudent) {
        row = candidate
        adopted = true
      }
    }

    const fields = {
      center_id: centerId,
      external_id: student.id,
      first_name: student.first_name,
      last_name: student.last_name ?? "",
      // Sin espacios sobrantes: el acceso del profesorado compara el nombre del grupo tal cual.
      current_class: student.group_name?.trim() || null,
      school_year: student.school_year,
    }

    if (row) {
      claimed.add(row.id)
      updates.push({ id: row.id, ...fields, email: student.email ?? row.email })
      if (adopted) needsLink.add(student.id)
    } else {
      inserts.push({ ...fields, email: student.email })
      needsLink.add(student.id)
    }
  }

  // Primero las fichas existentes (un cambio de nombre puede liberar un nombre que otro alumno
  // nuevo va a usar) y después las nuevas.
  const updated = await writeProfiles(supabase, updates, "id")
  const inserted = await writeProfiles(supabase, inserts, "center_id,external_id")

  const links = [...updated.saved, ...inserted.saved]
    .filter((p) => needsLink.has(p.external_id))
    .map((p) => ({ member_id: p.external_id, external_id: p.id }))

  return {
    saved: updated.saved.length + inserted.saved.length,
    skipped: updated.failed + inserted.failed,
    links,
  }
}

// Avisa al hub del vínculo miembro ↔ ficha de ClassMixer. Es informativo: se acota en tiempo y
// concurrencia, los fallos se ignoran y devuelve cuántos avisos quedaron sin enviar.
async function postStudentLinks(
  hubCenterId: string,
  links: { member_id: string; external_id: string }[]
): Promise<number> {
  const deadline = Date.now() + LINK_BUDGET_MS
  let next = 0

  const worker = async () => {
    while (next < links.length && Date.now() < deadline) {
      const link = links[next++]
      await postMemberLink(hubCenterId, link).catch(() => {})
    }
  }
  await Promise.all(Array.from({ length: LINK_CONCURRENCY }, worker))

  return links.length - next
}

// Sincroniza personal, alumnado y grupos de un centro de EduPlataforma hacia
// el centro de ClassMixer vinculado. Idempotente: se puede volver a llamar sin duplicar nada.
export async function syncCenter(classmixerCenterId: string): Promise<SyncResult> {
  const supabase = createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: center } = await (supabase as any)
    .from("centers")
    .select("id, eduplataforma_center_id")
    .eq("id", classmixerCenterId)
    .single()

  const eduplataformaCenterId = center?.eduplataforma_center_id as string | undefined
  if (!eduplataformaCenterId) {
    return { staff: 0, students: 0, groups: 0, skipped: 0, linksPending: 0, teacherAccess: null }
  }

  let staffCount = 0
  let groupCount = 0

  // Directorio completo (center_members) para poder cruzar personal ↔ member_id por
  // email: /api/center/[id]/users vive en la tabla `users` (rol de sistema), que no
  // comparte id con center_members (roster), de donde sale el member_id que espera
  // /member-links.
  const allMembers = await getMembers(eduplataformaCenterId)
  const memberIdByEmail = new Map(
    allMembers.filter((m) => m.email).map((m) => [m.email!.toLowerCase(), m.id])
  )

  // ── 1. Personal (admin/orientador/tutor) ────────────────────────────────────
  const staffUsers = await getUsers(eduplataformaCenterId)
  const staffAuthIdByEduId = new Map<string, string>()

  for (const staff of staffUsers) {
    const role = mapStaffRole(staff.role, staff.secondary_roles ?? [])
    if (!role || !staff.email) continue

    const authId = await getOrCreateAuthUserId(staff.email, staff.name ?? staff.email)
    staffAuthIdByEduId.set(staff.id, authId)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("users")
      .upsert(
        {
          id: authId,
          email: staff.email,
          name: staff.name ?? staff.email,
          role,
          center_id: classmixerCenterId,
          eduplataforma_user_id: staff.id,
        },
        { onConflict: "id" }
      )
    if (error) throw new Error(`Sync personal (${staff.email}): ${error.message}`)
    staffCount++

    const memberId = memberIdByEmail.get(staff.email.toLowerCase())
    if (memberId) {
      await postMemberLink(eduplataformaCenterId, { member_id: memberId, external_id: authId }).catch(() => {})
    }
  }

  // ── 1b. Acceso del profesorado a los grupos que imparte ──────────────────────
  // Va después del personal (necesita sus cuentas) y aislado: si el hub falla aquí, el alumnado
  // y los grupos se sincronizan igualmente, y el login vuelve a intentarlo para quien entra.
  let teacherAccess: TeacherAccessResult | null = null
  try {
    teacherAccess = await syncTeacherAccess({
      classmixerCenterId,
      hubCenterId: eduplataformaCenterId,
    })
  } catch (err) {
    console.error("[sync] acceso del profesorado:", err instanceof Error ? err.message : err)
  }

  // ── 2. Alumnado ──────────────────────────────────────────────────────────────
  const students = allMembers.filter((m) => m.type === "student")
  const studentResult = await syncStudents(supabase, classmixerCenterId, students)

  // ── 3. Grupos y tutores ───────────────────────────────────────────────────────
  const memberships = await getGroupMemberships(eduplataformaCenterId)
  const seenGroups = new Set<string>()

  for (const m of memberships) {
    if (!seenGroups.has(m.group_id)) {
      seenGroups.add(m.group_id)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("center_groups")
        .upsert(
          {
            center_id: classmixerCenterId,
            eduplataforma_group_id: m.group_id,
            name: m.group_name ?? "Sin nombre",
            school_year: m.school_year ?? "",
          },
          { onConflict: "center_id,eduplataforma_group_id" }
        )
      if (!error) groupCount++
    }

    if (m.role === "tutor") {
      const tutorAuthId = staffAuthIdByEduId.get(m.member_id)
      if (tutorAuthId && m.group_name) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("group_tutors")
          .upsert(
            {
              center_id: classmixerCenterId,
              group_name: m.group_name,
              school_year: m.school_year ?? "",
              user_id: tutorAuthId,
            },
            { onConflict: "center_id,group_name,school_year" }
          )
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("centers")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("id", classmixerCenterId)

  // Los avisos al hub van después de dejar la sincronización marcada como completada.
  const linksPending = await postStudentLinks(eduplataformaCenterId, studentResult.links)

  console.info(
    `[sync] centro ${classmixerCenterId}: personal=${staffCount} alumnos=${studentResult.saved} ` +
      `omitidos=${studentResult.skipped} grupos=${groupCount} avisos_pendientes=${linksPending} ` +
      (teacherAccess
        ? `profesorado=${teacherAccess.users} (accesos=${teacherAccess.rows}, sin_cuenta=${teacherAccess.unmatched})`
        : "profesorado=error")
  )

  return {
    staff: staffCount,
    students: studentResult.saved,
    groups: groupCount,
    skipped: studentResult.skipped,
    linksPending,
    teacherAccess,
  }
}
