import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import type { EmailOtpType } from "@supabase/supabase-js"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const token_hash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null
  const next = searchParams.get("next") ?? "/dashboard"

  const supabase = await createClient()

  // Email OTP: signup confirmation, password recovery, invite
  if (token_hash && type) {
    const { data: { user }, error } = await supabase.auth.verifyOtp({ token_hash, type })

    if (!error && user) {
      // Recovery → always go to set-password
      if (type === "recovery") {
        return NextResponse.redirect(`${origin}/set-password`)
      }

      // Invite → go to set-password so they create their password
      if (type === "invite") {
        return NextResponse.redirect(`${origin}/set-password?invite=1`)
      }

      // Regular signup confirmation
      const { data: profile } = await supabase
        .from("users")
        .select("id")
        .eq("id", user.id)
        .single()

      if (!profile) {
        return NextResponse.redirect(`${origin}/pending`)
      }
      return NextResponse.redirect(`${origin}${next}`)
    }

    return NextResponse.redirect(`${origin}/login?error=email_confirm_failed`)
  }

  // OAuth / PKCE code exchange
  if (code) {
    const { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && user) {
      const { data: profile } = await supabase
        .from("users")
        .select("id")
        .eq("id", user.id)
        .single()

      if (!profile) {
        return NextResponse.redirect(`${origin}/pending`)
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback`)
}
