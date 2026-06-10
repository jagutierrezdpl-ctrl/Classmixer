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
