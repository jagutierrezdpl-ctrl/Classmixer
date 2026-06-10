import type { SupabaseClient } from "@supabase/supabase-js"

export interface LicenseLimits {
  plan: string
  max_processes: number | null
  max_students: number | null
  max_users: number | null
  valid_until: string | null
}

export const PLAN_LIMITS: Record<string, LicenseLimits> = {
  free:       { plan: "free",       max_processes: 1,  max_students: 60,  max_users: 3,  valid_until: null },
  basic:      { plan: "basic",      max_processes: 5,  max_students: 120, max_users: 10, valid_until: null },
  pro:        { plan: "pro",        max_processes: 20, max_students: 200, max_users: 50, valid_until: null },
  enterprise: { plan: "enterprise", max_processes: null, max_students: null, max_users: null, valid_until: null },
}

export const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  basic: "Basic",
  pro: "Pro",
  enterprise: "Enterprise",
}

export async function getCenterLicense(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  centerId: string
): Promise<LicenseLimits> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("licenses")
    .select("plan, max_processes, max_students, max_users, valid_until")
    .eq("center_id", centerId)
    .single()

  if (!data) return PLAN_LIMITS.free

  // Check expiry
  if (data.valid_until && new Date(data.valid_until) < new Date()) {
    return PLAN_LIMITS.free
  }

  return data as LicenseLimits
}

export function isExpired(license: LicenseLimits): boolean {
  return !!license.valid_until && new Date(license.valid_until) < new Date()
}
