import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params
  const supabase = createServiceClient()

  // Verify center access
  const { data: process } = await supabase
    .from("processes")
    .select("center_id")
    .eq("id", id)
    .single()

  if (!process || process.center_id !== profile.center_id) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("sociogram_metrics")
    .select("student_id, received_count, given_count, reciprocal_count, centrality, betweenness, isolation_score, community_id")
    .eq("process_id", id)

  return NextResponse.json(data ?? [])
}
