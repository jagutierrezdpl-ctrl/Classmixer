import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, hasFullAccess, tutorCanAccessProcess } from "@/lib/auth"
import { NextResponse } from "next/server"
import { questionnaireSettingsSchema } from "@/schemas"

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

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params

  if (!(await checkAccess(profile, id))) {
    return NextResponse.json({ error: "Sin acceso a este proceso" }, { status: 403 })
  }

  const supabase = createServiceClient()
  const { data } = await supabase
    .from("questionnaire_settings")
    .select("*")
    .eq("process_id", id)
    .single()

  return NextResponse.json(data ?? null)
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (!["admin", "superadmin"].includes(profile.role)) {
    return NextResponse.json({ error: "Solo administradores pueden modificar la configuración del cuestionario" }, { status: 403 })
  }

  const { id } = await params

  const supabaseCheck = createServiceClient()
  const { data: process } = await supabaseCheck
    .from("processes")
    .select("center_id")
    .eq("id", id)
    .single()

  if (!process || process.center_id !== profile.center_id) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  }

  const body = await request.json()
  const parsed = questionnaireSettingsSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const supabase = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("questionnaire_settings")
    .upsert({ ...parsed.data, process_id: id }, { onConflict: "process_id" })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
