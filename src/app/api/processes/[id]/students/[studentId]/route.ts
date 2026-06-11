import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/auth"
import { NextResponse } from "next/server"

const ALLOWED_FIELDS = ["behavior_level", "needs_type", "academic_level", "observations", "average_grade"] as const
type AllowedField = typeof ALLOWED_FIELDS[number]

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; studentId: string }> }
) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id: processId, studentId } = await params
  const body = await request.json()

  // Only allow specific fields to be updated
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update: Record<string, any> = {}
  for (const field of ALLOWED_FIELDS) {
    if (field in body) update[field] = body[field] ?? null
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No hay campos válidos para actualizar" }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Verify the student belongs to a process of this center
  const { data: student } = await supabase
    .from("students")
    .select("id, process_id, processes!inner(center_id)")
    .eq("id", studentId)
    .eq("process_id", processId)
    .single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!student || (student as any).processes?.center_id !== profile.center_id) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("students")
    .update(update)
    .eq("id", studentId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
