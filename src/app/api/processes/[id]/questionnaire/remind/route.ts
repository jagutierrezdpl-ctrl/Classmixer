import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, logAudit } from "@/lib/auth"
import { NextResponse } from "next/server"
import { sendEmail, buildReminderEmailHtml } from "@/lib/email"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (!["admin", "superadmin"].includes(profile.role)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 })
  }

  const { id } = await params
  const supabase = createServiceClient()

  const [{ data: process }, { data: tokens }, { data: settings }] = await Promise.all([
    supabase.from("processes").select("name").eq("id", id).single(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("questionnaire_tokens")
      .select("id, token, completed_at, students(first_name, last_name)")
      .eq("process_id", id),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("questionnaire_settings")
      .select("deadline")
      .eq("process_id", id)
      .maybeSingle(),
  ])

  if (!process) return NextResponse.json({ error: "Proceso no encontrado" }, { status: 404 })

  const allTokens = (tokens ?? []) as {
    id: string
    token: string
    completed_at: string | null
    students: { first_name: string; last_name: string } | null
  }[]

  const pending = allTokens.filter(t => !t.completed_at)
  const total = allTokens.length

  if (pending.length === 0) {
    return NextResponse.json({ sent: false, reason: "No hay alumnos pendientes" })
  }

  const origin = request.headers.get("origin") ?? "https://classmixer-lovat.vercel.app"

  const pendingStudents = pending.map(t => ({
    name: t.students
      ? `${t.students.first_name} ${t.students.last_name}`
      : "Alumno/a",
    url: `${origin}/q/${t.token}`,
  }))

  const deadlineLabel = settings?.deadline
    ? new Date(settings.deadline).toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : undefined

  const html = buildReminderEmailHtml({
    processName: process.name,
    pendingCount: pending.length,
    totalCount: total,
    pendingStudents,
    deadlineLabel,
  })

  const result = await sendEmail({
    to: profile.email,
    subject: `[ClassMixer] Recordatorio: ${pending.length} alumnos sin responder — ${process.name}`,
    html,
  })

  await logAudit(profile.id, profile.center_id, "send_reminder_email", "process", {
    processId: id,
    metadata: { pending: pending.length, total, emailSent: result.success },
  })

  return NextResponse.json({
    sent: result.success,
    pending: pending.length,
    total,
    error: result.success ? undefined : result.error,
  })
}
