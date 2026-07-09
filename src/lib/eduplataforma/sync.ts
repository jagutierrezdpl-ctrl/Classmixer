import { createServiceClient } from "@/lib/supabase/server"
import {
  getUsers,
  getMembers,
  getGroupMemberships,
  postMemberLink,
} from "@/lib/eduplataforma/client"

// Mapea el rol de sistema de EduPlataforma al rol de ClassMixer.
// Alumno/familia/pas/superadmin/foundation_admin no tienen cuenta de personal
// en ClassMixer (no gestionan agrupaciones/sociogramas).
function mapStaffRole(role: string, secondaryRoles: string[]): "admin" | "orientador" | "tutor" | null {
  const roles = [role, ...secondaryRoles]
  if (roles.includes("admin") || roles.includes("director_general")) return "admin"
  if (roles.includes("orientador")) return "orientador"
  if (roles.includes("tutor")) return "tutor"
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

// Sincroniza personal, alumnado y grupos de un centro de EduPlataforma hacia
// el centro de ClassMixer vinculado. Idempotente: se puede volver a llamar sin duplicar nada.
export async function syncCenter(classmixerCenterId: string): Promise<{ staff: number; students: number; groups: number }> {
  const supabase = createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: center } = await (supabase as any)
    .from("centers")
    .select("id, eduplataforma_center_id")
    .eq("id", classmixerCenterId)
    .single()

  const eduplataformaCenterId = center?.eduplataforma_center_id as string | undefined
  if (!eduplataformaCenterId) return { staff: 0, students: 0, groups: 0 }

  let staffCount = 0
  let studentCount = 0
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

  // ── 2. Alumnado ──────────────────────────────────────────────────────────────
  const students = allMembers.filter((m) => m.type === "student")

  for (const student of students) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile, error } = await (supabase as any)
      .from("student_profiles")
      .upsert(
        {
          center_id: classmixerCenterId,
          external_id: student.id,
          first_name: student.first_name,
          last_name: student.last_name ?? "",
          email: student.email,
          current_class: student.group_name,
          school_year: student.school_year,
        },
        { onConflict: "center_id,external_id" }
      )
      .select("id")
      .single()

    if (error) throw new Error(`Sync alumno (${student.first_name}): ${error.message}`)
    studentCount++

    if (profile?.id) {
      await postMemberLink(eduplataformaCenterId, { member_id: student.id, external_id: profile.id as string }).catch(() => {})
    }
  }

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

  return { staff: staffCount, students: studentCount, groups: groupCount }
}
