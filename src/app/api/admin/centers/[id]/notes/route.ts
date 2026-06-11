import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await getUserProfile()
  if (!profile || profile.role !== "superadmin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { id: centerId } = await params
  const { content, note_type = "nota" } = await request.json()

  if (!content?.trim()) return NextResponse.json({ error: "El contenido no puede estar vacío" }, { status: 400 })

  const VALID_TYPES = ["nota", "incidencia", "resuelto", "aviso"]
  if (!VALID_TYPES.includes(note_type)) {
    return NextResponse.json({ error: "Tipo de nota inválido" }, { status: 400 })
  }

  const supabase = createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("admin_center_notes")
    .insert({
      center_id: centerId,
      author_id: profile.id,
      author_name: profile.name ?? profile.email,
      content: content.trim(),
      note_type,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
