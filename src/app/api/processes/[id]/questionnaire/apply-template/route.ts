/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/auth"
import { NextResponse } from "next/server"

// Aplica un preset de la plantilla sobre la capa "avanzada" (questionnaire_questions).
// No toca questionnaire_settings: los 4 tipos legacy se siguen configurando aparte.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (!["admin", "superadmin"].includes(profile.role)) {
    return NextResponse.json({ error: "Solo administradores pueden aplicar plantillas" }, { status: 403 })
  }

  const { id } = await params
  const supabase = createServiceClient()

  const { data: process } = await supabase.from("processes").select("center_id").eq("id", id).single()
  if (!process || process.center_id !== profile.center_id) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  }

  const body = await request.json()
  const templateId = body?.template_id
  if (!templateId) return NextResponse.json({ error: "Falta template_id" }, { status: 400 })

  const { data: templateQuestions, error } = await supabase
    .from("questionnaire_template_questions")
    .select("question_type_id, default_enabled, default_min, default_max, sort_order")
    .eq("template_id", templateId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!templateQuestions || templateQuestions.length === 0) {
    return NextResponse.json({ error: "Plantilla vacía o no encontrada" }, { status: 404 })
  }

  const rows = (templateQuestions as any[]).map(tq => ({
    process_id: id,
    question_type_id: tq.question_type_id,
    enabled: tq.default_enabled,
    min: tq.default_min,
    max: tq.default_max,
    sort_order: tq.sort_order,
  }))

  const { error: upsertError } = await (supabase as any)
    .from("questionnaire_questions")
    .upsert(rows, { onConflict: "process_id,question_type_id" })

  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 })
  return NextResponse.json({ success: true, applied: rows.length })
}
