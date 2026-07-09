import { createHmac, timingSafeEqual } from "crypto"

// Verificador del token de SSO emitido por EduPlataforma en
// GET /api/auth/link?module=classmixer (apps/hub/src/lib/platform-auth.ts).
// Mismo formato HS256 manual (header.body.sig, base64url) — no hay paquete
// compartido entre los dos repos, así que se reimplementa aquí.

export interface PlatformToken {
  email: string
  name: string | null
  eduplataforma_center_id: string
  eduplataforma_center_name: string | null
  eduplataforma_user_id: string
  eduplataforma_member_id: string | null
  active_school_year: string | null
  role: string
  secondary_roles: string[]
  exp: number
}

function base64url(str: string): string {
  return Buffer.from(str).toString("base64url")
}

const HEADER = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }))

export function verifyPlatformToken(token: string): PlatformToken {
  const secret = process.env.EDUPLATFORMA_SECRET
  if (!secret) throw new Error("EDUPLATFORMA_SECRET not set")

  const parts = token.split(".")
  if (parts.length !== 3) throw new Error("invalid_token")

  const [header, body, sig] = parts
  if (header !== HEADER) throw new Error("invalid_token")

  const expected = createHmac("sha256", secret)
    .update(`${HEADER}.${body}`)
    .digest("base64url")

  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error("invalid_signature")

  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf-8")) as PlatformToken
  if (payload.exp < Math.floor(Date.now() / 1000)) throw new Error("token_expired")

  return payload
}
