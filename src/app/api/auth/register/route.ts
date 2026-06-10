import { createServiceClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { registerCenterSchema } from "@/schemas"
import { createClient } from "@supabase/supabase-js"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = registerCenterSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const {
      center_name, city, country, center_type, phone, web,
      admin_name, email, password,
    } = parsed.data

    const supabase = createServiceClient()

    // Check if email is already registered
    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: "Este email ya está registrado" }, { status: 409 })
    }

    // Create center
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: center, error: centerError } = await (supabase as any)
      .from("centers")
      .insert({
        name: center_name,
        city,
        country,
        ...(center_type ? { type: center_type } : {}),
        ...(phone ? { phone } : {}),
        ...(web ? { web } : {}),
      })
      .select()
      .single()

    if (centerError || !center) {
      return NextResponse.json(
        { error: `Error centro: ${centerError?.message ?? "sin datos"} | code: ${centerError?.code}` },
        { status: 500 }
      )
    }

    // Create Supabase auth user using the anon client (so Supabase sends the confirmation email)
    const anonClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const origin = new URL(request.url).origin
    const { data: authData, error: authError } = await anonClient.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${origin}/api/auth/callback`,
        data: { name: admin_name, center_id: center.id },
      },
    })

    if (authError || !authData.user) {
      await supabase.from("centers").delete().eq("id", center.id)
      return NextResponse.json(
        { error: `Error auth: ${authError?.message ?? "sin usuario"}` },
        { status: 500 }
      )
    }

    // Create user profile
    const { error: profileError } = await supabase.from("users").insert({
      id: authData.user.id,
      email,
      name: admin_name,
      role: "admin",
      center_id: center.id,
    })

    if (profileError) {
      await supabase.from("centers").delete().eq("id", center.id)
      return NextResponse.json(
        { error: `Error perfil: ${profileError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, message: "Revisa tu email para confirmar la cuenta" })

  } catch (e) {
    return NextResponse.json(
      { error: `Excepción: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 }
    )
  }
}
