import { createServiceClient } from "@/lib/supabase/server"
import { getUserProfile } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  const profile = await getUserProfile()
  if (!profile || profile.role !== "superadmin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { id: centerId, noteId } = await params
  const supabase = createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("admin_center_notes")
    .delete()
    .eq("id", noteId)
    .eq("center_id", centerId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
