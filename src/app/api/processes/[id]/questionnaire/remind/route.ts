import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile, logAudit } from "@/lib/auth"
import { NextResponse } from "next/server"
import { sendEmail } from "@/lib/email"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (!["admin", "superadmin"].includes(profile.role)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  // student_id: single student; student_ids: selection; omit: all pending
  const { student_id, student_ids }: { student_id?: string; student_ids?: string[] } = body

  const supabase = createServiceClient()

  const [{ data: process }, { data: tokens }, { data: settings }] = await Promise.all([
    supabase.from("processes").select("name").eq("id", id).single(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("questionnaire_tokens")
      .select("student_id, token, completed_at, students(first_name, last_name, email, student_profiles(email))")
      .eq("process_id", id),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("questionnaire_settings")
      .select("deadline")
      .eq("process_id", id)
      .maybeSingle(),
  ])

  if (!process) return NextResponse.json({ error: "Proceso no encontrado" }, { status: 404 })

  type TokenRow = {
    student_id: string
    token: string
    completed_at: string | null
    students: {
      first_name: string
      last_name: string
      email?: string | null
      student_profiles?: { email?: string | null } | null
    } | null
  }

  const allTokens = (tokens ?? []) as TokenRow[]

  // Filter candidates
  const selectionSet = student_ids ? new Set(student_ids) : null
  const pending = allTokens.filter(t => {
    if (student_id) return !t.completed_at && t.student_id === student_id
    if (selectionSet) return !t.completed_at && selectionSet.has(t.student_id)
    return !t.completed_at
  })

  if (pending.length === 0) {
    const reason = student_id
      ? "El alumno ya respondió o no existe"
      : student_ids
        ? "Todos los alumnos seleccionados ya respondieron"
        : "No hay alumnos pendientes"
    return NextResponse.json({ sent: false, reason })
  }

  const { origin } = new URL(request.url)

  const deadlineLabel = settings?.deadline
    ? new Date(settings.deadline).toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })
    : undefined

  const getEmail = (t: TokenRow) => t.students?.email || t.students?.student_profiles?.email || null

  const withEmail = pending.filter(t => getEmail(t))
  const withoutEmail = pending.filter(t => !getEmail(t))

  let sentIndividual = 0
  const individualErrors: string[] = []

  for (const t of withEmail) {
    const student = t.students!
    const result = await sendEmail({
      to: getEmail(t)!,
      subject: `Recuerda responder el cuestionario — ${process.name}`,
      html: buildStudentReminderHtml({
        firstName: student.first_name,
        processName: process.name,
        url: `${origin}/q/${t.token}`,
        deadlineLabel,
      }),
    })
    if (result.success) sentIndividual++
    else individualErrors.push(`${student.first_name} ${student.last_name}: ${result.error}`)
  }

  // Send summary to admin only when sending to all (not single/selection)
  let adminEmailSent = false
  if (!student_id && !student_ids) {
    const adminResult = await sendEmail({
      to: profile.email,
      subject: `[ClassMixer] Recordatorio enviado: ${pending.length} alumnos pendientes — ${process.name}`,
      html: buildAdminSummaryHtml({
        processName: process.name,
        pendingCount: pending.length,
        totalCount: allTokens.length,
        sentIndividual,
        withoutEmail: withoutEmail.length,
        pendingStudents: pending.map(t => ({
          name: t.students ? `${t.students.first_name} ${t.students.last_name}` : "Alumno/a",
          url: `${origin}/q/${t.token}`,
          hasEmail: !!getEmail(t),
        })),
        deadlineLabel,
      }),
    })
    adminEmailSent = adminResult.success
  }

  await logAudit(profile.id, profile.center_id, "send_reminder_email", "process", {
    processId: id,
    metadata: { student_id: student_id ?? null, pending: pending.length, sentIndividual },
  })

  return NextResponse.json({
    sent: true,
    pending: pending.length,
    total: allTokens.length,
    sentIndividual,
    withoutEmail: withoutEmail.length,
    adminEmailSent,
    errors: individualErrors.length > 0 ? individualErrors : undefined,
  })
}

function buildStudentReminderHtml(opts: {
  firstName: string
  processName: string
  url: string
  deadlineLabel?: string
}): string {
  const deadline = opts.deadlineLabel
    ? `<p style="color:#666;">Fecha límite: <strong>${opts.deadlineLabel}</strong></p>`
    : ""
  return `<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;color:#1a1a1a;max-width:480px;margin:0 auto;padding:24px;">
  <h2 style="color:#4f46e5;">Hola, ${opts.firstName} 👋</h2>
  <p>Todavía no has respondido el cuestionario de <strong>${opts.processName}</strong>.</p>
  <p>Solo te llevará unos minutos. Haz clic en el botón para responder:</p>
  ${deadline}
  <a href="${opts.url}" style="display:inline-block;margin:16px 0;padding:12px 28px;background:#4f46e5;color:white;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">
    Responder cuestionario
  </a>
  <p style="color:#999;font-size:12px;margin-top:24px;">
    Si el botón no funciona, copia este enlace:<br/>
    <a href="${opts.url}" style="color:#4f46e5;">${opts.url}</a>
  </p>
  <hr style="margin:24px 0;border:none;border-top:1px solid #eee;">
  <p style="font-size:11px;color:#bbb;">Enviado por ClassMixer · No respondas a este correo.</p>
</body>
</html>`
}

function buildAdminSummaryHtml(opts: {
  processName: string
  pendingCount: number
  totalCount: number
  sentIndividual: number
  withoutEmail: number
  pendingStudents: { name: string; url: string; hasEmail: boolean }[]
  deadlineLabel?: string
}): string {
  const rows = opts.pendingStudents.slice(0, 30).map(s => `
    <tr>
      <td style="padding:6px 12px;border-bottom:1px solid #eee;">${s.name}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #eee;color:${s.hasEmail ? "#16a34a" : "#d97706"};font-size:12px;">
        ${s.hasEmail ? "✓ Email enviado" : "Sin email"}
      </td>
      <td style="padding:6px 12px;border-bottom:1px solid #eee;">
        <a href="${s.url}" style="color:#6366f1;font-size:12px;">Abrir enlace</a>
      </td>
    </tr>`).join("")

  const more = opts.pendingStudents.length > 30
    ? `<p style="color:#999;font-size:13px;">...y ${opts.pendingStudents.length - 30} alumnos más.</p>`
    : ""

  const deadline = opts.deadlineLabel
    ? `<p style="color:#888;">Fecha límite: <strong>${opts.deadlineLabel}</strong></p>`
    : ""

  return `<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;color:#1e1b4b;max-width:600px;margin:0 auto;padding:24px;">
  <h2 style="color:#4f46e5;">ClassMixer — Recordatorios enviados</h2>
  <p>Proceso: <strong>${opts.processName}</strong></p>
  <p>
    <strong>${opts.pendingCount}</strong> alumnos pendientes de <strong>${opts.totalCount}</strong>.
    ${opts.sentIndividual > 0 ? `Se enviaron <strong>${opts.sentIndividual} emails individuales</strong>.` : ""}
    ${opts.withoutEmail > 0 ? `<span style="color:#d97706;">${opts.withoutEmail} sin email registrado.</span>` : ""}
  </p>
  ${deadline}
  <table style="width:100%;border-collapse:collapse;margin-top:16px;">
    <thead>
      <tr style="background:#f5f3ff;">
        <th style="padding:8px 12px;text-align:left;">Alumno/a</th>
        <th style="padding:8px 12px;text-align:left;">Email</th>
        <th style="padding:8px 12px;text-align:left;">Enlace</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  ${more}
  <hr style="margin:24px 0;border:none;border-top:1px solid #eee;">
  <p style="font-size:12px;color:#aaa;">Enviado desde ClassMixer.</p>
</body>
</html>`
}
