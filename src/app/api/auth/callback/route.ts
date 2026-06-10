import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/dashboard"

  if (code) {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && user) {
      // Check if user has a profile in the users table
      const { data: profile } = await supabase
        .from("users")
        .select("id")
        .eq("id", user.id)
        .single()

      if (!profile) {
        // OAuth user with no center assignment yet — send to pending page
        return NextResponse.redirect(`${origin}/pending`)
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback`)
}
