import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const profile = await getUserProfile()
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { name } = await params
  const groupName = decodeURIComponent(name)
  const supabase = createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("group_tutors")
    .select("id, group_name, school_year, user_id, users(id, name, email, role)")
    .eq("center_id", profile.center_id)
    .eq("group_name", groupName)
    .order("school_year", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request, { params }: { params: Promise<{ name: string }> }) {
  const profile = await getUserProfile()
  if (!profile || !["admin", "superadmin"].includes(profile.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const { name } = await params
  const groupName = decodeURIComponent(name)
  const body = await request.json()
  const { user_id, school_year } = body

  if (!user_id || !school_year) {
    return NextResponse.json({ error: "user_id y school_year son obligatorios" }, { status: 400 })
  }

  const supabase = createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("group_tutors")
    .upsert(
      { center_id: profile.center_id, group_name: groupName, school_year, user_id },
      { onConflict: "center_id,group_name,school_year" }
    )
    .select("id, group_name, school_year, user_id, users(id, name, email)")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: Request, { params }: { params: Promise<{ name: string }> }) {
  const profile = await getUserProfile()
  if (!profile || !["admin", "superadmin"].includes(profile.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const { name } = await params
  const groupName = decodeURIComponent(name)
  const { searchParams } = new URL(request.url)
  const school_year = searchParams.get("school_year")

  const supabase = createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("group_tutors")
    .delete()
    .eq("center_id", profile.center_id)
    .eq("group_name", groupName)

  if (school_year) query = query.eq("school_year", school_year)

  const { error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
