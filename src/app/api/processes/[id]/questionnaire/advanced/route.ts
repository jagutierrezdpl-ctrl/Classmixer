/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, hasFullAccess, tutorCanAccessProcess } from "@/lib/auth"
import { NextResponse } from "next/server"
import { LEGACY_QUESTION_CODES } from "@/lib/questionnaire/catalog"

async function checkAccess(profile: { id: string; center_id: string; role: string }, processId: string) {
  const supabase = createServiceClient()
  const { data: process } = await supabase
    .from("processes")
    .select("center_id")
    .eq("id", processId)
    .single()

  if (!process || process.center_id !== profile.center_id) return false
  return hasFullAccess(profile.role) || tutorCanAccessProcess(profile.center_id, profile.id, processId)
}

// Preguntas "avanzadas" = todo el catálogo activo excepto los 4 tipos legacy,
// que siguen gestionándose desde questionnaire_settings (no desde esta tabla).
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params
  if (!(await checkAccess(profile, id))) {
    return NextResponse.json({ error: "Sin acceso a este proceso" }, { status: 403 })
  }

  const supabase = createServiceClient()

  const { data: types, error } = await supabase
    .from("question_types")
    .select("*")
    .eq("active", true)
    .or(`center_id.is.null,center_id.eq.${profile.center_id}`)
    .not("code", "in", `(${LEGACY_QUESTION_CODES.join(",")})`)
    .order("category")
    .order("code")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: questions } = await supabase
    .from("questionnaire_questions")
    .select("*")
    .eq("process_id", id)

  const byTypeId = new Map((questions ?? []).map((q: any) => [q.question_type_id, q]))

  const merged = (types ?? []).map((t: any) => {
    const q = byTypeId.get(t.id)
    return {
      question_type_id: t.id,
      code: t.code,
      category: t.category,
      label: t.label,
      description: t.description,
      icon: t.icon,
      color: t.color,
      sensitivity: t.sensitivity,
      input_mode: t.input_mode,
      enabled: q?.enabled ?? false,
      min: q?.min ?? t.default_min,
      max: q?.max ?? t.default_max,
    }
  })

  return NextResponse.json(merged)
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (!["admin", "superadmin"].includes(profile.role)) {
    return NextResponse.json({ error: "Solo administradores pueden modificar la configuración del cuestionario" }, { status: 403 })
  }

  const { id } = await params
  const supabase = createServiceClient()

  const { data: process } = await supabase.from("processes").select("center_id").eq("id", id).single()
  if (!process || process.center_id !== profile.center_id) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  }

  const body = await request.json()
  const questions = Array.isArray(body?.questions) ? body.questions : []
  if (questions.length === 0) return NextResponse.json({ error: "Sin cambios" }, { status: 400 })

  const requestedTypeIds: string[] = [...new Set(questions.map((q: any) => q.question_type_id))] as string[]
  const { data: allowedTypes } = await supabase
    .from("question_types")
    .select("id")
    .eq("active", true)
    .or(`center_id.is.null,center_id.eq.${profile.center_id}`)
    .in("id", requestedTypeIds)

  if ((allowedTypes ?? []).length !== requestedTypeIds.length) {
    return NextResponse.json({ error: "Tipo de pregunta no válido" }, { status: 400 })
  }

  const rows = questions.map((q: any) => ({
    process_id: id,
    question_type_id: q.question_type_id,
    enabled: !!q.enabled,
    min: q.min ?? null,
    max: q.max ?? null,
  }))

  const { error } = await (supabase as any)
    .from("questionnaire_questions")
    .upsert(rows, { onConflict: "process_id,question_type_id" })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
