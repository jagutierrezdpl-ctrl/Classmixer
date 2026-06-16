import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, hasFullAccess, tutorCanAccessProcess, logAudit } from "@/lib/auth"
import { NextResponse } from "next/server"
import { randomBytes } from "crypto"

function generateToken(): string {
  return randomBytes(12).toString("base64url")
}

async function getOwnedProcess(processId: string, centerId: string) {
  const supabase = createServiceClient()
  const { data: process } = await supabase
    .from("processes")
    .select("center_id")
    .eq("id", processId)
    .single()
  if (!process || process.center_id !== centerId) return null
  return process
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (!["admin", "superadmin"].includes(profile.role)) {
    return NextResponse.json({ error: "Solo administradores pueden generar tokens del cuestionario" }, { status: 403 })
  }

  const { id } = await params

  if (!(await getOwnedProcess(id, profile.center_id))) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  }

  const supabase = createServiceClient()

  // Get all active students in process
  const { data: students, error: studentsError } = await supabase
    .from("students")
    .select("id, first_name, last_name")
    .eq("process_id", id)
    .eq("active", true)

  if (studentsError || !students) {
    return NextResponse.json({ error: "Error al obtener alumnos" }, { status: 500 })
  }

  // Delete existing tokens
  await supabase.from("questionnaire_tokens").delete().eq("process_id", id)

  // Generate new tokens
  const tokens = students.map(s => ({
    process_id: id,
    student_id: s.id,
    token: generateToken(),
    used: false,
  }))

  const { data: inserted, error: insertError } = await supabase
    .from("questionnaire_tokens")
    .insert(tokens)
    .select("token, student_id")

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  // Update process status
  await supabase
    .from("processes")
    .update({ status: "cuestionario_abierto", updated_at: new Date().toISOString() })
    .eq("id", id)

  await logAudit(profile.id, profile.center_id, "generate_tokens", "questionnaire_token", {
    processId: id,
    metadata: { count: tokens.length },
  })

  const { origin } = new URL(request.url)
  const tokenLinks = (inserted ?? []).map(t => ({
    student_id: t.student_id,
    token: t.token,
    url: `${origin}/q/${t.token}`,
  }))

  return NextResponse.json({
    generated: tokens.length,
    tokens: tokenLinks,
    general_url: `${origin}/q/`,
  })
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { id } = await params

  if (!(await getOwnedProcess(id, profile.center_id))) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  }
  if (!hasFullAccess(profile.role) && !(await tutorCanAccessProcess(profile.center_id, profile.id, id))) {
    return NextResponse.json({ error: "Sin acceso a este proceso" }, { status: 403 })
  }

  const supabase = createServiceClient()

  const { data } = await supabase
    .from("questionnaire_tokens")
    .select("*, students(first_name, last_name, current_class)")
    .eq("process_id", id)
    .order("used")

  const { origin } = new URL(request.url)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enriched = ((data ?? []) as any[]).map((t: any) => ({
    ...t,
    url: `${origin}/q/${t.token}`,
  }))

  return NextResponse.json(enriched)
}
