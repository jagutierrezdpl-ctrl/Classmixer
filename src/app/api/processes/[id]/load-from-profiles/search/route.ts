import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (!["admin", "superadmin"].includes(profile.role)) {
    return NextResponse.json({ error: "Solo administradores pueden cargar alumnos" }, { status: 403 })
  }

  const { id: processId } = await params
  const { searchParams } = new URL(request.url)
  const q = searchParams.get("q")?.trim() ?? ""

  if (q.length < 2) return NextResponse.json([])

  const supabase = createServiceClient()

  const { data: process } = await supabase
    .from("processes")
    .select("id")
    .eq("id", processId)
    .eq("center_id", profile.center_id)
    .single()

  if (!process) return NextResponse.json({ error: "Proceso no encontrado" }, { status: 404 })

  // Get student_profile_ids already in this process
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from("students")
    .select("student_profile_id, external_id")
    .eq("process_id", processId)
    .eq("active", true)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existingProfileIds = new Set((existing ?? []).map((s: any) => s.student_profile_id).filter(Boolean))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existingExternalIds = new Set((existing ?? []).map((s: any) => s.external_id).filter(Boolean))

  // Search profiles by name
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: found } = await (supabase as any)
    .from("student_profiles")
    .select("id, external_id, first_name, last_name, current_class, gender, average_grade, academic_level, behavior_level, needs_type, email")
    .eq("center_id", profile.center_id)
    .eq("active", true)
    .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
    .order("last_name")
    .limit(20)

  const results = (found ?? []).map((p: { id: string; external_id?: string; [key: string]: unknown }) => ({
    ...p,
    already_in_process: existingProfileIds.has(p.id) || (p.external_id && existingExternalIds.has(p.external_id)),
  }))

  return NextResponse.json(results)
}
