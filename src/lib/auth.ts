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
 * Returns true if a tutor has access to the given process.
 * A tutor has access when:
 *   - they are explicitly in process_tutors, OR
 *   - any of their assigned groups overlaps with the process's source_groups
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
  const tutorGroups = await getTutorGroups(centerId, userId)
  if (tutorGroups.length === 0) return false

  const { data: process } = await supabase
    .from("processes")
    .select("source_groups")
    .eq("id", processId)
    .eq("center_id", centerId)
    .single()

  if (!process) return false
  const sourceGroups = (process.source_groups ?? []) as string[]
  return tutorGroups.some(g => sourceGroups.includes(g))
}

export async function logAudit(
  userId: string,
  centerId: string,
  action: string,
  entityType: string,
  options?: { processId?: string; entityId?: string; metadata?: Record<string, unknown> }
) {
  const supabase = await createClient()
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
