import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile || !["admin", "superadmin", "orientador"].includes(profile.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }
  const { id } = await params
  const supabase = createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("orientation_notes")
    .select("*")
    .eq("student_profile_id", id)
    .eq("center_id", profile.center_id)
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getUserProfile()
  if (!profile || !["admin", "superadmin", "orientador"].includes(profile.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }
  const { id } = await params
  const { content } = await req.json()
  if (!content?.trim()) return NextResponse.json({ error: "El contenido no puede estar vacío" }, { status: 400 })

  const supabase = createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("orientation_notes")
    .insert({
      student_profile_id: id,
      center_id: profile.center_id,
      author_id: profile.id,
      author_name: profile.name ?? profile.email,
      content: content.trim(),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
