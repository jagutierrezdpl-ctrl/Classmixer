import { createServiceClient } from "@/lib/supabase/server"
import { getCenterInfo, getMembers, getTeacherSubjects } from "@/lib/eduplataforma/client"

// Acceso del profesorado al alumnado: un profesor ve solo los grupos en los que EduPlataforma
// (teacher_subjects del curso activo del centro) dice que da clase. Se guarda en
// teacher_group_access y lo consulta getStudentAccessScope (lib/auth).
//
// El cruce hub → ClassMixer es por email: el profesor del hub es un center_member (id propio,
// no compartido con la cuenta) y la cuenta de ClassMixer es la de `users`.

const WRITE_CHUNK = 500

export interface TeacherAccessResult {
  // Curso escolar del que salen las asignaciones (null: el hub no tiene curso activo y no se toca nada).
  schoolYear: string | null
  // Cuentas de ClassMixer que quedan con al menos un grupo.
  users: number
  // Pares cuenta-grupo vigentes tras sincronizar.
  rows: number
  // Profesores con asignaciones que aún no tienen cuenta en ClassMixer (no han entrado nunca).
  unmatched: number
}

interface AccessRow {
  center_id: string
  user_id: string
  group_name: string
  school_year: string
}

const keyOf = (r: { user_id: string; group_name: string; school_year: string }) =>
  `${r.user_id}\u0000${r.group_name}\u0000${r.school_year}`

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

// Reconcilia teacher_group_access con lo que dice el hub. Sustituye el estado anterior por
// completo (los grupos que el profesor ya no imparte pierden el acceso) y solo si la lectura
// del hub ha ido bien: cualquier error del hub lanza antes de tocar la tabla.
//
//   onlyEmail  refresca únicamente a esa persona (login por SSO); el resto no se toca.
export async function syncTeacherAccess(args: {
  classmixerCenterId: string
  hubCenterId: string
  onlyEmail?: string
}): Promise<TeacherAccessResult> {
  const { classmixerCenterId, hubCenterId } = args
  const onlyEmail = args.onlyEmail?.trim().toLowerCase()
  const supabase = createServiceClient()

  const { active_school_year: schoolYear } = await getCenterInfo(hubCenterId)
  if (!schoolYear) return { schoolYear: null, users: 0, rows: 0, unmatched: 0 }

  // La lista de profesores se pide aparte (no se reutiliza el directorio completo de la
  // sincronización): es corta y así no depende del tamaño total del centro.
  const [assignments, members] = await Promise.all([
    getTeacherSubjects(hubCenterId, schoolYear),
    getMembers(hubCenterId, { type: "teacher" }),
  ])

  // Solo profesores activos y con email: sin email no hay forma de saber qué cuenta es la suya.
  const emailByTeacherId = new Map<string, string>()
  for (const m of members) {
    if (m.type !== "teacher" || !m.active || !m.email?.trim()) continue
    emailByTeacherId.set(m.id, m.email.trim().toLowerCase())
  }

  // email → grupos que imparte este curso
  const groupsByEmail = new Map<string, Set<string>>()
  for (const a of assignments) {
    const email = a.teacher_id ? emailByTeacherId.get(a.teacher_id) : undefined
    const group = a.group_name?.trim()
    if (!email || !group) continue
    if (onlyEmail && email !== onlyEmail) continue
    if (!groupsByEmail.has(email)) groupsByEmail.set(email, new Set())
    groupsByEmail.get(email)!.add(group)
  }

  // Cuentas de ClassMixer del centro (email → id). Aquí no se mira el rol: el acceso por
  // docencia solo se aplica al rol tutor (ver getStudentAccessScope), y así sobrevive a un
  // cambio de rol sin esperar a otra sincronización.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: userRows, error: usersError } = await (supabase as any)
    .from("users")
    .select("id, email")
    .eq("center_id", classmixerCenterId)
  if (usersError) throw new Error(`Acceso profesorado (usuarios): ${usersError.message}`)

  const userIdByEmail = new Map<string, string>()
  for (const u of (userRows ?? []) as { id: string; email: string | null }[]) {
    if (u.email) userIdByEmail.set(u.email.trim().toLowerCase(), u.id)
  }

  const desired = new Map<string, AccessRow>()
  let unmatched = 0
  for (const [email, groups] of groupsByEmail) {
    const userId = userIdByEmail.get(email)
    if (!userId) {
      unmatched++
      continue
    }
    for (const group of groups) {
      const row = { center_id: classmixerCenterId, user_id: userId, group_name: group, school_year: schoolYear }
      desired.set(keyOf(row), row)
    }
  }

  // Estado actual (paginado: PostgREST corta en 1000 filas por petición).
  const existing: AccessRow[] = []
  for (let from = 0; ; from += 1000) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (supabase as any)
      .from("teacher_group_access")
      .select("center_id, user_id, group_name, school_year")
      .eq("center_id", classmixerCenterId)
      .order("user_id")
      .order("group_name")
      .order("school_year")
      .range(from, from + 999)
    if (onlyEmail) {
      // Solo las filas de la cuenta refrescada (o ninguna si aún no existe la cuenta).
      const uid = userIdByEmail.get(onlyEmail)
      if (!uid) break
      q = q.eq("user_id", uid)
    }
    const { data, error } = await q
    if (error) throw new Error(`Acceso profesorado (lectura): ${error.message}`)
    existing.push(...((data ?? []) as AccessRow[]))
    if (!data || data.length < 1000) break
  }

  // Altas: lo que el hub dice y aún no está. Bajas: lo que está y el hub ya no dice.
  const existingKeys = new Set(existing.map(keyOf))
  const toInsert = [...desired.values()].filter((r) => !existingKeys.has(keyOf(r)))
  const toDelete = existing.filter((r) => !desired.has(keyOf(r)))

  for (const batch of chunk(toInsert, WRITE_CHUNK)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("teacher_group_access")
      .upsert(batch, { onConflict: "center_id,user_id,group_name,school_year" })
    if (error) throw new Error(`Acceso profesorado (alta): ${error.message}`)
  }

  // Las bajas se agrupan por cuenta y curso: la clave primaria es compuesta y PostgREST borra
  // con filtros, no con listas de claves.
  const deletes = new Map<string, { user_id: string; school_year: string; groups: string[] }>()
  for (const r of toDelete) {
    const k = `${r.user_id}\u0000${r.school_year}`
    if (!deletes.has(k)) deletes.set(k, { user_id: r.user_id, school_year: r.school_year, groups: [] })
    deletes.get(k)!.groups.push(r.group_name)
  }
  for (const d of deletes.values()) {
    for (const groups of chunk(d.groups, WRITE_CHUNK)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("teacher_group_access")
        .delete()
        .eq("center_id", classmixerCenterId)
        .eq("user_id", d.user_id)
        .eq("school_year", d.school_year)
        .in("group_name", groups)
      if (error) throw new Error(`Acceso profesorado (baja): ${error.message}`)
    }
  }

  const finalUsers = new Set([...desired.values()].map((r) => r.user_id))
  return { schoolYear, users: finalUsers.size, rows: desired.size, unmatched }
}
