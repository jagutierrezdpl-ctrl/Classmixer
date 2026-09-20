import { createClient, createServiceClient } from "@/lib/supabase/server"
import type { UserRole } from "@/types"
import type { Database, Json } from "@/types/database"
import { redirect } from "next/navigation"

type UserProfile = Database["public"]["Tables"]["users"]["Row"]

export async function getUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
}

export async function getUserProfile(): Promise<UserProfile | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Use service client to bypass RLS for the profile lookup
  // (auth.getUser() already verified the session is valid)
  const serviceClient = createServiceClient()
  const { data: profile } = await serviceClient
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single()

  return profile as UserProfile | null
}

export async function requireAuth() {
  const user = await getUser()
  if (!user) redirect("/login")
  return user
}

export async function requireRole(allowedRoles: UserRole[]) {
  const profile = await getUserProfile()
  if (!profile) redirect("/login")
  if (!allowedRoles.includes(profile.role as UserRole)) {
    redirect("/dashboard")
  }
  return profile
}

/** Roles that have unrestricted read/write access to all center data. */
export function hasFullAccess(role: string): boolean {
  return ["admin", "superadmin", "orientador"].includes(role)
}

/** Returns the group names assigned to a tutor at this center. */
export async function getTutorGroups(centerId: string, userId: string): Promise<string[]> {
  const supabase = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("group_tutors")
    .select("group_name")
    .eq("center_id", centerId)
    .eq("user_id", userId)
  return (data ?? []).map((g: { group_name: string }) => g.group_name)
}

/**
 * Groups a person teaches at this center according to EduPlataforma (teacher_subjects of the
 * active school year, copied into teacher_group_access by the sync). Unlike group_tutors it
 * allows several teachers per group.
 */
export async function getTeachingGroups(centerId: string, userId: string): Promise<string[]> {
  return (await getTeachingAssignments(centerId, userId)).map(a => a.group_name)
}

/** The same rows with their school year (EduPlataforma format, "2026/2027"). */
export async function getTeachingAssignments(
  centerId: string,
  userId: string
): Promise<{ group_name: string; school_year: string }[]> {
  const supabase = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("teacher_group_access")
    .select("group_name, school_year")
    .eq("center_id", centerId)
    .eq("user_id", userId)
  return (data ?? []) as { group_name: string; school_year: string }[]
}

// EduPlataforma writes the school year as "2026/2027"; ClassMixer processes as "2026-2027".
function sameSchoolYear(a: string | null | undefined, b: string | null | undefined): boolean {
  const normalize = (year: string | null | undefined) => (year ?? "").replace(/\s/g, "").replace(/\//g, "-")
  return !!normalize(a) && normalize(a) === normalize(b)
}

/**
 * Whether one of the classes a person teaches is a source group of the process. Class names repeat
 * every year (this year's 4PA is not last year's cohort), so a class only counts for a process of
 * the same school year.
 */
function teachesInProcess(
  teaching: { group_name: string; school_year: string }[],
  process: { source_groups: string[] | null; school_year: string | null }
): boolean {
  const sourceGroups = process.source_groups ?? []
  return teaching.some(a => sourceGroups.includes(a.group_name) && sameSchoolYear(a.school_year, process.school_year))
}

/**
 * The classes a teacher works with: the ones they tutor in ClassMixer (group_tutors) plus the
 * ones they teach in EduPlataforma (teacher_group_access). Students, processes and cooperative
 * sessions are all reached through this one set. Callers check the role first: it is only
 * meaningful for role "tutor".
 */
export async function getTutoredAndTaughtGroups(centerId: string, userId: string): Promise<string[]> {
  const [tutored, taught] = await Promise.all([
    getTutorGroups(centerId, userId),
    getTeachingGroups(centerId, userId),
  ])
  return [...new Set([...tutored, ...taught])]
}

/** What a tutor has in each class: the ones they tutor and the ones they teach (with school year). */
export type TutorClassAccess = { tutored: string[]; teaching: { group_name: string; school_year: string }[] }

export async function getTutorClassAccess(centerId: string, userId: string): Promise<TutorClassAccess> {
  const [tutored, teaching] = await Promise.all([
    getTutorGroups(centerId, userId),
    getTeachingAssignments(centerId, userId),
  ])
  return { tutored, teaching }
}

/**
 * Whether a tutor reaches a class (its cooperative-group sessions) that belongs to a process: a class
 * they tutor always, one they teach only in the school year of that process. The one rule behind the
 * per-session gate and the session list.
 */
export function reachesClass(
  access: TutorClassAccess,
  className: string | null | undefined,
  processSchoolYear: string | null | undefined
): boolean {
  if (!className) return false
  return (
    access.tutored.includes(className) ||
    access.teaching.some(a => a.group_name === className && sameSchoolYear(a.school_year, processSchoolYear))
  )
}

/** Which student profiles (by current_class) a person may see. */
export type StudentAccessScope = { all: true } | { all: false; classes: string[] }

/**
 * Student-profile visibility:
 *   - admin / superadmin / orientador: the whole center.
 *   - tutor (EduPlataforma "profesor" and "tutor" both sign in with this role): only the classes
 *     they tutor in ClassMixer (group_tutors) plus the ones they teach in EduPlataforma.
 *   - any other role: nothing.
 */
export async function getStudentAccessScope(
  centerId: string,
  userId: string,
  role: string
): Promise<StudentAccessScope> {
  if (hasFullAccess(role)) return { all: true }
  if (role !== "tutor") return { all: false, classes: [] }
  return { all: false, classes: await getTutoredAndTaughtGroups(centerId, userId) }
}

export function canSeeClass(scope: StudentAccessScope, currentClass: string | null | undefined): boolean {
  if (scope.all) return true
  return !!currentClass && scope.classes.includes(currentClass)
}

/**
 * Returns true if a teacher has access to the given process.
 * A teacher has access when:
 *   - they are explicitly in process_tutors, OR
 *   - any of the groups they tutor overlaps with the process's source_groups, OR
 *   - any of the groups they teach in EduPlataforma does, in the process's school year (only for
 *     role "tutor": the teaching rows outlive a role change, and callers do not always have the
 *     role at hand, so it is read here)
 */
export async function tutorCanAccessProcess(
  centerId: string,
  userId: string,
  processId: string
): Promise<boolean> {
  const supabase = createServiceClient()

  // Check explicit assignment first (faster)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: assignment } = await (supabase as any)
    .from("process_tutors")
    .select("id")
    .eq("process_id", processId)
    .eq("user_id", userId)
    .maybeSingle()

  if (assignment) return true

  // Check group overlap
  const [tutorGroups, teaching] = await Promise.all([
    getTutorGroups(centerId, userId),
    getTeachingAssignments(centerId, userId),
  ])
  if (tutorGroups.length === 0 && teaching.length === 0) return false

  const { data: process } = await supabase
    .from("processes")
    .select("source_groups, school_year")
    .eq("id", processId)
    .eq("center_id", centerId)
    .single()

  if (!process) return false
  const sourceGroups = (process.source_groups ?? []) as string[]
  if (tutorGroups.some(g => sourceGroups.includes(g))) return true
  if (!teachesInProcess(teaching, process)) return false

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: account } = await (supabase as any)
    .from("users")
    .select("role")
    .eq("id", userId)
    .eq("center_id", centerId)
    .maybeSingle()
  return account?.role === "tutor"
}

type ProcessAccessProfile = Pick<UserProfile, "id" | "role" | "center_id">

/**
 * Whether a person may open a process (its pages and its APIs).
 *   - The process has to belong to their center.
 *   - admin / superadmin / orientador: any process of the center.
 *   - tutor (EduPlataforma "profesor" and "tutor" both sign in with this role): only processes
 *     they are assigned to (process_tutors) or whose source groups overlap the classes they
 *     tutor or teach (teaching counts for processes of the same school year). Same rule as the
 *     processes list.
 *   - any other role: none.
 * Checking the center alone is not enough: the data APIs use the service-role client, so this
 * is the only thing between a teacher and the sociometric data of classes that are not theirs.
 */
export async function canAccessProcess(profile: ProcessAccessProfile, processId: string): Promise<boolean> {
  if (!profile.center_id) return false
  const supabase = createServiceClient()
  const { data: proc } = await supabase
    .from("processes")
    .select("id")
    .eq("id", processId)
    .eq("center_id", profile.center_id)
    .maybeSingle()
  if (!proc) return false
  if (hasFullAccess(profile.role)) return true
  if (profile.role !== "tutor") return false
  return tutorCanAccessProcess(profile.center_id, profile.id, processId)
}

/** Ids of the center's processes this person may open (same rule as canAccessProcess, in bulk). */
export async function getAccessibleProcessIds(profile: ProcessAccessProfile): Promise<Set<string>> {
  if (!profile.center_id) return new Set()
  const supabase = createServiceClient()
  const { data } = await supabase
    .from("processes")
    .select("id, source_groups, school_year")
    .eq("center_id", profile.center_id)
  const processes = (data ?? []) as { id: string; source_groups: string[] | null; school_year: string | null }[]

  if (hasFullAccess(profile.role)) return new Set(processes.map(p => p.id))
  if (profile.role !== "tutor") return new Set()

  const [tutorGroups, teaching, assigned] = await Promise.all([
    getTutorGroups(profile.center_id, profile.id),
    getTeachingAssignments(profile.center_id, profile.id),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from("process_tutors").select("process_id").eq("user_id", profile.id),
  ])
  const assignedIds = new Set<string>((assigned.data ?? []).map((a: { process_id: string }) => a.process_id))

  return new Set(
    processes
      .filter(
        p =>
          assignedIds.has(p.id) ||
          tutorGroups.some(g => (p.source_groups ?? []).includes(g)) ||
          teachesInProcess(teaching, p)
      )
      .map(p => p.id)
  )
}

/**
 * Role part of the access rule for a cooperative-group session (the caller has already checked
 * that its process belongs to the center). A tutor only reaches sessions of the classes they
 * tutor, or teach in the school year of the session's process; any other non-full role, none
 * (a leftover process assignment of a former tutor does not count). The /api/cooperative routes
 * use this same rule.
 */
export async function canAccessGroupSession(
  profile: ProcessAccessProfile,
  session: { process_id: string; class_name: string | null }
): Promise<boolean> {
  if (!profile.center_id) return false
  if (hasFullAccess(profile.role)) return true
  if (profile.role !== "tutor") return false

  const className = session.class_name
  if (!className) return false
  const access = await getTutorClassAccess(profile.center_id, profile.id)
  if (access.tutored.includes(className)) return true
  if (!access.teaching.some(a => a.group_name === className)) return false

  // Taught, not tutored: it depends on the school year of the session's process
  const { data: process } = await createServiceClient()
    .from("processes")
    .select("school_year")
    .eq("id", session.process_id)
    .eq("center_id", profile.center_id)
    .maybeSingle()
  return !!process && reachesClass(access, className, process.school_year)
}

/**
 * Verify that a process belongs to the given center.
 * Returns the process row or null if not found / wrong center.
 * Use in API routes to replace the duplicated 5-line ownership check pattern.
 */
export async function verifyProcessAccess(
  processId: string,
  centerId: string
): Promise<{ id: string; center_id: string } | null> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from("processes")
    .select("id, center_id")
    .eq("id", processId)
    .eq("center_id", centerId)
    .single()
  return data ?? null
}

export async function logAudit(
  userId: string,
  centerId: string,
  action: string,
  entityType: string,
  options?: { processId?: string; entityId?: string; metadata?: Record<string, unknown> }
) {
  // Use service client: audit logs must always write regardless of session state in API routes
  const supabase = createServiceClient()
  await supabase.from("audit_logs").insert({
    user_id: userId,
    center_id: centerId,
    action,
    entity_type: entityType,
    process_id: options?.processId,
    entity_id: options?.entityId,
    metadata: (options?.metadata ?? null) as Json | null,
  })
}
