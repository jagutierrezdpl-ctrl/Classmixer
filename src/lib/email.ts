/**
 * Email helper using Resend. Requires RESEND_API_KEY env var.
 * If not configured, silently skips sending and returns { success: false }.
 */

interface SendEmailOptions {
  to: string | string[]
  subject: string
  html: string
  from?: string
}

interface SendEmailResult {
  success: boolean
  id?: string
  error?: string
}

export async function sendEmail(opts: SendEmailOptions): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY not configured — skipping email send")
    return { success: false, error: "RESEND_API_KEY not configured" }
  }

  const from = opts.from ?? (process.env.EMAIL_FROM ?? "ClassMixer <noreply@classmixer.app>")

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: Array.isArray(opts.to) ? opts.to : [opts.to],
        subject: opts.subject,
        html: opts.html,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      console.error("[email] Resend error:", data)
      return { success: false, error: data?.message ?? "Unknown error" }
    }

    return { success: true, id: data.id }
  } catch (err) {
    console.error("[email] sendEmail exception:", err)
    return { success: false, error: String(err) }
  }
}

export function buildReminderEmailHtml(opts: {
  processName: string
  pendingCount: number
  totalCount: number
  pendingStudents: { name: string; url: string }[]
  deadlineLabel?: string
}): string {
  const rows = opts.pendingStudents
    .slice(0, 20)
    .map(
      s =>
        `<tr>
          <td style="padding:6px 12px;border-bottom:1px solid #eee;">${s.name}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #eee;">
            <a href="${s.url}" style="color:#6366f1;">Acceder al cuestionario</a>
          </td>
        </tr>`
    )
    .join("")

  const more =
    opts.pendingStudents.length > 20
      ? `<p style="color:#888;font-size:13px;">...y ${opts.pendingStudents.length - 20} alumnos más.</p>`
      : ""

  const deadline = opts.deadlineLabel
    ? `<p style="color:#888;">Fecha límite: <strong>${opts.deadlineLabel}</strong></p>`
    : ""

  return `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;color:#1e1b4b;max-width:600px;margin:0 auto;padding:24px;">
  <h2 style="color:#4f46e5;">ClassMixer — Recordatorio de cuestionario</h2>
  <p>El proceso <strong>${opts.processName}</strong> tiene <strong>${opts.pendingCount} alumnos pendientes</strong> de completar el cuestionario sociométrico (de ${opts.totalCount} en total).</p>
  ${deadline}
  <table style="width:100%;border-collapse:collapse;margin-top:16px;">
    <thead>
      <tr style="background:#f5f3ff;">
        <th style="padding:8px 12px;text-align:left;">Alumno/a</th>
        <th style="padding:8px 12px;text-align:left;">Enlace</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  ${more}
  <hr style="margin:24px 0;border:none;border-top:1px solid #eee;">
  <p style="font-size:12px;color:#aaa;">Este mensaje fue enviado desde ClassMixer. No respondas a este correo.</p>
</body>
</html>
  `.trim()
}
