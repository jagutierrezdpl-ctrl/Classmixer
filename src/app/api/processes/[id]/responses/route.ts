import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, hasFullAccess, tutorCanAccessProcess } from "@/lib/auth"
import { NextResponse } from "next/server"
import { getQuestionCatalogIndex } from "@/lib/questionnaire/catalog"
import { filterVisibleResponses } from "@/lib/questionnaire/visibility"
import type { UserRole } from "@/types"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params
  const supabase = createServiceClient()

  const { data: process } = await supabase
    .from("processes")
    .select("center_id")
    .eq("id", id)
    .single()

  if (!process || process.center_id !== profile.center_id) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  }
  if (!hasFullAccess(profile.role) && !(await tutorCanAccessProcess(profile.center_id, profile.id, id))) {
    return NextResponse.json({ error: "Sin acceso a este proceso" }, { status: 403 })
  }

  const { data, error } = await supabase
    .from("responses")
    .select("*")
    .eq("process_id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Tutors cannot see emotional or negative responses (confidential data)
  const catalogIndex = await getQuestionCatalogIndex(profile.center_id)
  const filtered = filterVisibleResponses(data ?? [], profile.role as UserRole, catalogIndex.sensitivity)

  return NextResponse.json(filtered)
}
