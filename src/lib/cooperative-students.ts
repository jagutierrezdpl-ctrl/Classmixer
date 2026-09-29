/* eslint-disable @typescript-eslint/no-explicit-any */
import { classKey } from "@/lib/class-names"

// El alumnado sincronizado desde EduPlataforma vive en student_profiles; los grupos cooperativos
// leen `students`, que siempre cuelga de un proceso. Si la clase aún no está en ningún proceso,
// se vuelca en un proceso "Grupos cooperativos <curso>" (uno por centro y curso, se reutiliza).
export async function ensureClassStudents(
  supabase: any,
  profile: { id: string; center_id: string },
  className: string,
  allow: (studentClass: string) => Promise<boolean>
): Promise<{ process_id: string; class_name: string } | "forbidden" | null> {
  const wanted = classKey(className)

  const { data: rows } = await supabase
    .from("student_profiles")
    .select("*")
    .eq("center_id", profile.center_id)
    .not("current_class", "is", null)

  const candidates = ((rows ?? []) as any[]).filter(p => classKey(p.current_class) === wanted)
  if (candidates.length === 0) return null

  // Varias cohortes pueden compartir nombre: se toma la del curso más reciente
  const latestYear = candidates.map(p => p.school_year ?? "").sort().at(-1) as string
  const profiles = candidates.filter(p => (p.school_year ?? "") === latestYear)
  const studentClass: string = profiles[0].current_class
  if (!(await allow(studentClass))) return "forbidden"
  const schoolYear = latestYear ? latestYear.replace(/\s/g, "").replace(/\//g, "-") : "sin-curso"

  const name = `Grupos cooperativos ${schoolYear}`
  const { data: existing } = await supabase
    .from("processes")
    .select("id, source_groups")
    .eq("center_id", profile.center_id)
    .eq("name", name)
    .maybeSingle()

  let processId: string
  if (existing) {
    processId = existing.id
    const groups: string[] = existing.source_groups ?? []
    if (!groups.includes(studentClass)) {
      const next = [...groups, studentClass]
      await supabase.from("processes").update({ source_groups: next, target_groups: next }).eq("id", processId)
    }
  } else {
    const { data: created, error } = await supabase
      .from("processes")
      .insert({
        center_id: profile.center_id,
        name,
        school_year: schoolYear,
        process_type: "sociograma",
        source_level: "Grupos cooperativos",
        target_level: "Grupos cooperativos",
        source_groups: [studentClass],
        target_groups: [studentClass],
        target_class_count: 1,
        created_by: profile.id,
      })
      .select("id")
      .single()
    if (error || !created) return null
    processId = created.id
  }

  const { data: present } = await supabase
    .from("students")
    .select("student_profile_id")
    .eq("process_id", processId)
    .not("student_profile_id", "is", null)
  const have = new Set((present ?? []).map((s: { student_profile_id: string }) => s.student_profile_id))

  const toInsert = profiles
    .filter(p => !have.has(p.id))
    .map(p => ({
      process_id: processId,
      student_profile_id: p.id,
      external_id: p.external_id ?? null,
      first_name: p.first_name,
      last_name: p.last_name,
      email: p.email ?? null,
      current_class: studentClass,
      gender: p.gender ?? null,
      average_grade: p.average_grade != null ? p.average_grade : 5.0,
      academic_level: p.academic_level ?? null,
      behavior_level: p.behavior_level ?? null,
      needs_type: p.needs_type ?? null,
      observations: p.observations ?? null,
      active: true,
    }))

  for (let i = 0; i < toInsert.length; i += 100) {
    const { error } = await supabase.from("students").insert(toInsert.slice(i, i + 100))
    if (error) return null
  }

  return { process_id: processId, class_name: studentClass }
}
