import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/auth"
import { getCenterLicense } from "@/lib/license"
import { NextResponse } from "next/server"

export async function GET() {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const supabase = createServiceClient()
  const license = await getCenterLicense(supabase, profile.center_id)

  // Attach current usage counts
  const processIds = await supabase
    .from("processes")
    .select("id", { count: "exact", head: true })
    .eq("center_id", profile.center_id)
    .not("status", "eq", "archivado")

  const userCount = await supabase
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("center_id", profile.center_id)

  return NextResponse.json({
    ...license,
    used_processes: processIds.count ?? 0,
    used_users: userCount.count ?? 0,
  })
}
