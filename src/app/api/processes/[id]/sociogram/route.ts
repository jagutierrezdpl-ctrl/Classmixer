import { createClient } from "@/lib/supabase/server"
import { getUserProfile, logAudit } from "@/lib/auth"
import { NextResponse } from "next/server"
import { calculateSociogram } from "@/lib/sociogram/calculate"

// Roles that can see emotional and negative response data
const SENSITIVE_ROLES = ["admin", "superadmin", "orientador"]

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params
  const supabase = await createClient()

  const [{ data: students }, { data: allResponses }] = await Promise.all([
    supabase.from("students").select("*").eq("process_id", id).eq("active", true),
    supabase.from("responses").select("*").eq("process_id", id),
  ])

  if (!students) return NextResponse.json({ error: "Error al cargar alumnos" }, { status: 500 })

  // Tutors cannot see emotional or negative responses
  const canSeeSensitive = SENSITIVE_ROLES.includes(profile.role)
  const responses = canSeeSensitive
    ? (allResponses ?? [])
    : (allResponses ?? []).filter((r: { relation_type: string }) =>
        r.relation_type !== "emotional" && r.relation_type !== "negative"
      )

  // Log sociogram access for orientadors (sensitive data access tracking)
  if (profile.role === "orientador") {
    await logAudit(profile.id, profile.center_id, "view_sociogram", "process", {
      processId: id,
      metadata: { role: profile.role },
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sociogram = calculateSociogram(students as any, responses as any)

  return NextResponse.json({
    ...sociogram,
    viewer_role: profile.role,
    can_see_sensitive: canSeeSensitive,
  })
}
