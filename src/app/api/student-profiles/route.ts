import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/auth"
import { NextResponse } from "next/server"

// GET /api/student-profiles — list all profiles for center
export async function GET(request: Request) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const q = searchParams.get("q") ?? ""
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"))
  const pageSize = 50

  const supabase = createServiceClient()
  let query = supabase
    .from("student_profiles")
    .select("*", { count: "exact" })
    .eq("center_id", profile.center_id)
    .order("last_name")
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (q) {
    query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,external_id.ilike.%${q}%`)
  }

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ profiles: data ?? [], total: count ?? 0 })
}
