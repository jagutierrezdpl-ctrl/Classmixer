import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/auth"
import { NextResponse } from "next/server"

const SENSITIVE_ROLES = ["admin", "superadmin", "orientador"]

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from("responses")
    .select("*")
    .eq("process_id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Tutors cannot see emotional or negative responses (confidential data)
  const canSeeSensitive = SENSITIVE_ROLES.includes(profile.role)
  const filtered = canSeeSensitive
    ? (data ?? [])
    : (data ?? []).filter((r: { relation_type: string }) =>
        r.relation_type !== "emotional" && r.relation_type !== "negative"
      )

  return NextResponse.json(filtered)
}
