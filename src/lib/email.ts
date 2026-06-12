import nodemailer from "nodemailer"

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

function createTransport() {
  const host = process.env.EMAIL_SMTP_HOST
  const port = parseInt(process.env.EMAIL_SMTP_PORT ?? "587")
  const user = process.env.EMAIL_SMTP_USER
  const pass = process.env.EMAIL_SMTP_PASS

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    })
  }

  // Fallback: Resend via SMTP
  const resendKey = process.env.RESEND_API_KEY
  if (resendKey) {
    return nodemailer.createTransport({
      host: "smtp.resend.com",
      port: 587,
      secure: false,
      auth: { user: "resend", pass: resendKey },
    })
  }

  return null
}

export async function sendEmail(opts: SendEmailOptions): Promise<SendEmailResult> {
  const transport = createTransport()
  if (!transport) {
    console.warn("[email] No email transport configured")
    return { success: false, error: "No email transport configured" }
  }

  const from = opts.from ?? (process.env.EMAIL_FROM ?? "ClassMixer <noreply@classmixer.app>")

  try {
    const info = await transport.sendMail({
      from,
      to: Array.isArray(opts.to) ? opts.to.join(", ") : opts.to,
      subject: opts.subject,
      html: opts.html,
    })
    return { success: true, id: info.messageId }
  } catch (err) {
    console.error("[email] sendMail error:", err)
    return { success: false, error: String(err) }
  }
}
