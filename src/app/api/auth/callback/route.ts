import { createServerClient } from "@supabase/ssr"
import { createServiceClient } from "@/lib/supabase/server"
import { NextResponse, type NextRequest } from "next/server"
import type { EmailOtpType } from "@supabase/supabase-js"

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const token_hash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null
  const next = searchParams.get("next") ?? "/dashboard"

  // Build a mutable redirect response so we can attach cookies to it
  const makeRedirect = (url: string) => {
    const res = NextResponse.redirect(url)
    return res
  }

  const buildSupabase = (response: NextResponse) =>
    createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options)
            })
          },
        },
      }
    )

  // Email OTP: invite or password recovery
  if (token_hash && type) {
    const response = makeRedirect(`${origin}/login?error=auth_callback`)
    const supabase = buildSupabase(response)

    const { data: { user }, error } = await supabase.auth.verifyOtp({ token_hash, type })

    if (!error && user) {
      if (type === "recovery") {
        response.headers.set("Location", `${origin}/set-password`)
        return response
      }
      if (type === "invite") {
        response.headers.set("Location", `${origin}/set-password?invite=1`)
        return response
      }
      // Regular email confirmation
      response.headers.set("Location", `${origin}${next}`)
      return response
    }

    return response
  }

  // PKCE / OAuth code exchange
  if (code) {
    const response = makeRedirect(`${origin}/login?error=auth_callback`)
    const supabase = buildSupabase(response)

    const { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && user) {
      // Use service client to bypass RLS — the anon client's cookies may not
      // carry the new session yet at this point in the same request.
      const serviceClient = createServiceClient()
      const { data: profile } = await serviceClient
        .from("users")
        .select("id, center_id")
        .eq("id", user.id)
        .single()

      // No profile OR pending state (center_id=null) → activation needed
      if (!profile || !profile.center_id) {
        response.headers.set("Location", `${origin}/pending`)
        return response
      }

      response.headers.set("Location", `${origin}${next}`)
      return response
    }

    return response
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback`)
}
